from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.labs.service import (
    create_observations_from_document,
    delete_document_labs,
    delete_lab_observation,
    get_observation_detail,
    latest_summary,
    list_tests,
    timeline_for_test,
)

router = APIRouter(prefix="/api/labs", tags=["Lab Timeline"])


@router.get("/tests")
def get_tests() -> dict[str, object]:
    tests = list_tests()
    return {"count": len(tests), "tests": tests}


@router.get("/timeline/{test_code}")
def get_timeline(test_code: str) -> dict[str, object]:
    points = timeline_for_test(test_code)
    return {
        "test_code": test_code,
        "count": len(points),
        "points": points,
    }


@router.get("/summary")
def get_summary() -> dict[str, object]:
    points = latest_summary()
    return {"count": len(points), "points": points}


@router.get("/observations/{observation_id}")
def get_observation(observation_id: str) -> dict[str, object]:
    detail = get_observation_detail(observation_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Observation not found.")
    return detail


@router.delete("/observations/{observation_id}")
def remove_observation(observation_id: str) -> dict[str, object]:
    deleted = delete_lab_observation(observation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Observation not found.")
    return {"deleted": True, "observation_id": observation_id}


@router.delete("/documents/{document_id}")
def remove_document_labs(document_id: str) -> dict[str, object]:
    count = delete_document_labs(document_id)
    return {"deleted": True, "document_id": document_id, "observation_count": count}


@router.post("/from-document/{document_id}")
def from_document(document_id: str, payload: dict[str, object]) -> dict[str, object]:
    """Promote confirmed document fields into verified lab observations."""
    fields = payload.get("fields") or []
    pages = payload.get("pages") or []
    if not isinstance(fields, list) or not fields:
        raise HTTPException(status_code=400, detail="Confirmed fields are required.")
    if not isinstance(pages, list):
        pages = []

    result = create_observations_from_document(
        document_id=document_id,
        filename=str(payload.get("filename") or "document"),
        page_count=int(payload.get("page_count") or 0),
        pages=[item for item in pages if isinstance(item, dict)],
        fields=[item for item in fields if isinstance(item, dict)],
        report_date=str(payload.get("report_date") or "") or None,
        storage_path=str(payload.get("storage_path") or ""),
    )
    return result
