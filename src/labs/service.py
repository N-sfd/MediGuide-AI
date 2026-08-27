from __future__ import annotations

from typing import Any

from src.database.repository import (
    get_observation,
    get_timeline,
    list_tracked_tests,
    upsert_confirmed_document,
)
from src.database.session import init_db, session_scope


def ensure_db() -> None:
    init_db()


def create_observations_from_document(
    *,
    document_id: str,
    filename: str,
    page_count: int,
    pages: list[dict[str, Any]],
    fields: list[dict[str, Any]],
    report_date: str | None = None,
    storage_path: str = "",
) -> dict[str, Any]:
    ensure_db()
    with session_scope() as session:
        document = upsert_confirmed_document(
            session,
            document_id=document_id,
            filename=filename,
            page_count=page_count,
            pages=pages,
            fields=fields,
            report_date=report_date,
            storage_path=storage_path,
        )
        count = len(document.lab_observations)
        return {
            "document_id": document.id,
            "lab_observation_count": count,
            "confirmed": True,
        }


def list_tests() -> list[dict[str, Any]]:
    ensure_db()
    with session_scope() as session:
        return list_tracked_tests(session)


def timeline_for_test(test_code: str) -> list[dict[str, Any]]:
    ensure_db()
    with session_scope() as session:
        return get_timeline(session, test_code)


def get_observation_detail(observation_id: str) -> dict[str, Any] | None:
    ensure_db()
    with session_scope() as session:
        return get_observation(session, observation_id)
