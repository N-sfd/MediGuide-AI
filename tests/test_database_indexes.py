"""Asserts the 7 columns migration 005_timeline_search_indexes indexes are
actually indexed on a freshly created schema — catches a future model edit
that silently drops `index=True` without anyone touching the migration
file itself (dev/test schemas come from Base.metadata.create_all(), not
`alembic upgrade`, so a model/migration drift here would otherwise go
unnoticed until a real deploy)."""

from __future__ import annotations

from sqlalchemy import inspect

EXPECTED_INDEXED_COLUMNS = {
    "documents": {"confirmed", "report_date"},
    "medication_records": {"confirmed_at", "medication_name"},
    "lab_observations": {"test_name"},
    "imaging_studies": {"verification_status"},
    "imaging_report_sections": {"verification_status"},
}


def test_timeline_and_search_columns_are_indexed(db_session):
    engine = db_session.get_engine()
    inspector = inspect(engine)

    for table, expected_columns in EXPECTED_INDEXED_COLUMNS.items():
        indexed_columns: set[str] = set()
        for index in inspector.get_indexes(table):
            indexed_columns.update(index["column_names"])
        missing = expected_columns - indexed_columns
        assert not missing, f"{table} is missing indexes on {missing}"
