"""Unified Health Timeline: a read-only, cross-domain index over already
verified/confirmed data (Labs, Imaging, Documents, Medications). It builds
nothing new to look at — every entry links back to its existing detail
view. See src/database/timeline_repository.py for the aggregation query
and the classification rules (why an entry becomes Imaging vs Laboratory
vs Document vs Medication).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from src.database.session import probe_database, session_scope
from src.database.timeline_repository import get_timeline_entries

router = APIRouter(prefix="/api/timeline", tags=["Health Timeline"])


@router.get("")
async def list_timeline_entries() -> dict[str, Any]:
    with session_scope() as session:
        entries = get_timeline_entries(session)
    return {"entries": entries}


def probe_timeline() -> tuple[bool, str]:
    db_ok, db_detail = probe_database()
    if not db_ok:
        return False, db_detail
    try:
        with session_scope() as session:
            get_timeline_entries(session)
        return True, "Timeline reachable"
    except Exception as error:
        return False, f"Unreadable ({type(error).__name__})"
