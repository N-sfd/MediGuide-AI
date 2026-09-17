"""Automates the migration sanity check that was previously done by hand
for every sprint: upgrade from scratch to head, inspect the imaging schema,
downgrade, and upgrade again — on an isolated sqlite file, never
data/mediguide.db.

Runs alembic in a subprocess rather than via its Python API: migrations/
env.py unconditionally does `from src.config import DATABASE_URL` and
`config.set_main_option("sqlalchemy.url", DATABASE_URL)`, ignoring whatever
URL a caller sets on the Config object — and since src.config is already
imported (with the real DATABASE_URL baked in) by the time any test file
runs, in-process monkeypatching cannot reach it either. A subprocess with
DATABASE_URL set in its own environment is the only way to point alembic
at a scratch database without touching data/mediguide.db.
"""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _run_alembic(*args: str, db_path: Path) -> None:
    env = dict(os.environ)
    env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    result = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert result.returncode == 0, (
        f"alembic {' '.join(args)} failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )


def _table_names(db_path: Path) -> set[str]:
    con = sqlite3.connect(db_path)
    try:
        rows = con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        return {row[0] for row in rows}
    finally:
        con.close()


def _foreign_keys(db_path: Path, table: str) -> list[tuple]:
    con = sqlite3.connect(db_path)
    try:
        return con.execute(f"PRAGMA foreign_key_list({table})").fetchall()
    finally:
        con.close()


def _indexes(db_path: Path, table: str) -> list[str]:
    con = sqlite3.connect(db_path)
    try:
        rows = con.execute(f"PRAGMA index_list({table})").fetchall()
        return [row[1] for row in rows]
    finally:
        con.close()


def test_upgrade_head_creates_imaging_schema(tmp_path):
    db_path = tmp_path / "migration_test.db"
    _run_alembic("upgrade", "head", db_path=db_path)

    tables = _table_names(db_path)
    assert {"imaging_studies", "imaging_series", "imaging_report_sections"} <= tables

    study_fks = {fk[2] for fk in _foreign_keys(db_path, "imaging_studies")}
    assert "documents" in study_fks  # report_document_id -> documents.id

    series_fks = {fk[2] for fk in _foreign_keys(db_path, "imaging_series")}
    assert series_fks == {"imaging_studies"}

    section_fks = {fk[2] for fk in _foreign_keys(db_path, "imaging_report_sections")}
    assert section_fks == {"imaging_studies", "documents"}

    section_indexes = _indexes(db_path, "imaging_report_sections")
    assert any(
        "document_id" in name or "uq_imaging_report_section" in name for name in section_indexes
    )


def test_downgrade_then_upgrade_again_is_idempotent(tmp_path):
    """Deliberately does not hardcode which migration is "head" or "head
    minus one" — that assumption goes stale every time a new migration is
    added on top (it already did once: this test used to assert imaging
    tables specifically disappeared on the first downgrade, which broke
    the moment 004_medications became head instead of 003_imaging). Instead
    it checks the general property: one step back removes something
    without touching earlier, stable migrations, and a full round trip
    restores the exact same schema."""
    db_path = tmp_path / "migration_roundtrip.db"

    _run_alembic("upgrade", "head", db_path=db_path)
    tables_at_head = _table_names(db_path)
    assert {"imaging_studies", "imaging_series", "imaging_report_sections"} <= tables_at_head

    _run_alembic("downgrade", "-1", db_path=db_path)
    tables_after_downgrade = _table_names(db_path)
    assert tables_after_downgrade < tables_at_head
    assert {"documents", "processing_jobs", "imaging_studies"} <= tables_after_downgrade

    _run_alembic("downgrade", "base", db_path=db_path)
    assert _table_names(db_path) in ({"alembic_version"}, set())

    _run_alembic("upgrade", "head", db_path=db_path)
    assert _table_names(db_path) == tables_at_head


def test_cascade_delete_removes_dependent_rows(tmp_path):
    """SQLite doesn't enforce FKs by default in this app (see
    src/database/session.py), so cascade behavior is really an ORM
    responsibility — this checks the ORM-level cascade against a freshly
    migrated (not create_all'd) schema."""
    db_path = tmp_path / "cascade_test.db"
    _run_alembic("upgrade", "head", db_path=db_path)

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from src.database.models import Document, ImagingReportSection, ImagingStudy

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    session = sessionmaker(bind=engine)()
    try:
        document = Document(filename="report.pdf")
        session.add(document)
        session.flush()

        study = ImagingStudy(modality="mri", report_document_id=document.id)
        session.add(study)
        session.flush()

        section = ImagingReportSection(
            study_id=study.id,
            document_id=document.id,
            section_type="findings",
            section_text="No acute fracture.",
        )
        session.add(section)
        session.commit()
        section_id = section.id

        session.delete(study)
        session.commit()

        assert session.get(ImagingReportSection, section_id) is None
        # The shared Document must survive the study's deletion.
        assert session.get(Document, document.id) is not None
    finally:
        session.close()
        engine.dispose()
