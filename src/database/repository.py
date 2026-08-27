from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.database.models import Document, DocumentPage, ExtractedField, LabObservation
from src.labs.normalization import (
    TRACKED_LAB_CODES,
    is_tracked_lab,
    normalize_test_name,
    parse_numeric_value,
    parse_reference_range,
)


def _parse_report_date(raw: str | None) -> date | None:
    if not raw:
        return None
    text = raw.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    match = re.search(r"(20\d{2})[-/](\d{1,2})[-/](\d{1,2})", text)
    if match:
        year, month, day = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
        try:
            return date(year, month, day)
        except ValueError:
            return None
    return None


def upsert_confirmed_document(
    session: Session,
    *,
    document_id: str,
    filename: str,
    page_count: int,
    pages: list[dict[str, Any]],
    fields: list[dict[str, Any]],
    report_date: str | None = None,
    storage_path: str = "",
) -> Document:
    """Persist a human-confirmed document and promote tracked labs."""
    document = session.get(Document, document_id)
    if document is None:
        document = Document(id=document_id, filename=filename)
        session.add(document)

    document.filename = filename
    document.page_count = page_count
    document.status = "confirmed"
    document.confirmed = True
    document.storage_path = storage_path or document.storage_path
    parsed_date = _parse_report_date(report_date)
    if parsed_date:
        document.report_date = parsed_date

    # Replace pages / fields / observations for this confirmation pass.
    for observation in list(document.lab_observations):
        session.delete(observation)
    for field in list(document.fields):
        session.delete(field)
    for page in list(document.pages):
        session.delete(page)
    session.flush()

    page_by_number: dict[int, DocumentPage] = {}
    for page_info in pages:
        page_number = int(page_info.get("page_number") or 1)
        page = DocumentPage(
            document_id=document.id,
            page_number=page_number,
            preview_path=str(page_info.get("preview_url") or ""),
            text_available=bool(page_info.get("text_available")),
        )
        session.add(page)
        page_by_number[page_number] = page

    session.flush()

    for raw_field in fields:
        page_number = int(raw_field.get("page_number") or 1)
        page = page_by_number.get(page_number)
        if page is None:
            page = DocumentPage(
                document_id=document.id,
                page_number=page_number,
                text_available=False,
            )
            session.add(page)
            session.flush()
            page_by_number[page_number] = page

        field = ExtractedField(
            document_id=document.id,
            page_id=page.id,
            field_id=str(raw_field.get("field_id") or ""),
            label=str(raw_field.get("label") or ""),
            value=str(raw_field.get("value") or ""),
            unit=str(raw_field.get("unit") or ""),
            reference_range=str(raw_field.get("reference_range") or ""),
            status=str(raw_field.get("status") or "unknown"),
            confidence=str(raw_field.get("confidence") or "needs_review"),
            page_number=page_number,
            source_text=str(raw_field.get("source_text") or ""),
            user_edited=bool(raw_field.get("user_edited")),
            user_confirmed=True,
        )
        session.add(field)
        session.flush()

        code = normalize_test_name(field.label)
        if not is_tracked_lab(code):
            continue

        low, high = parse_reference_range(field.reference_range)
        observation = LabObservation(
            document_id=document.id,
            field_id=field.id,
            page_number=page_number,
            test_code=code,
            test_name=field.label,
            value_numeric=parse_numeric_value(field.value),
            value_text=field.value,
            unit=field.unit,
            reference_low=low,
            reference_high=high,
            reference_text=field.reference_range,
            report_date=document.report_date or date.today(),
            verification_state="human_verified",
            document_name=document.filename,
        )
        session.add(observation)

    session.flush()
    return document


def list_tracked_tests(session: Session) -> list[dict[str, Any]]:
    rows = session.execute(
        select(
            LabObservation.test_code,
            LabObservation.test_name,
        ).distinct()
    ).all()
    present = {row.test_code: row.test_name for row in rows}
    results: list[dict[str, Any]] = []
    for code, display in TRACKED_LAB_CODES.items():
        count = session.execute(
            select(LabObservation).where(LabObservation.test_code == code)
        ).scalars().all()
        results.append(
            {
                "test_code": code,
                "display_name": display,
                "observation_count": len(count),
                "has_data": code in present,
            }
        )
    return results


def get_timeline(session: Session, test_code: str) -> list[dict[str, Any]]:
    code = normalize_test_name(test_code)
    observations = session.execute(
        select(LabObservation)
        .where(LabObservation.test_code == code)
        .options(
            selectinload(LabObservation.document),
            selectinload(LabObservation.field),
        )
        .order_by(LabObservation.report_date.asc(), LabObservation.created_at.asc())
    ).scalars().all()

    points: list[dict[str, Any]] = []
    for item in observations:
        logical_field_id = item.field.field_id if item.field else item.field_id
        points.append(
            {
                "observation_id": item.id,
                "test_code": item.test_code,
                "test_name": item.test_name,
                "value": item.value_numeric,
                "value_text": item.value_text,
                "unit": item.unit,
                "reference_low": item.reference_low,
                "reference_high": item.reference_high,
                "reference_text": item.reference_text,
                "report_date": item.report_date.isoformat() if item.report_date else None,
                "document_id": item.document_id,
                "document_name": item.document_name or (
                    item.document.filename if item.document else ""
                ),
                "page_number": item.page_number,
                "field_id": logical_field_id,
                "verification_state": item.verification_state,
            }
        )
    return points


def get_observation(session: Session, observation_id: str) -> Optional[dict[str, Any]]:
    item = session.get(LabObservation, observation_id)
    if item is None:
        return None
    logical_field_id = item.field.field_id if item.field else item.field_id
    return {
        "observation_id": item.id,
        "test_code": item.test_code,
        "test_name": item.test_name,
        "value": item.value_numeric,
        "value_text": item.value_text,
        "unit": item.unit,
        "reference_text": item.reference_text,
        "report_date": item.report_date.isoformat() if item.report_date else None,
        "document_id": item.document_id,
        "document_name": item.document_name,
        "page_number": item.page_number,
        "field_id": logical_field_id,
        "verification_state": item.verification_state,
        "preview_path": f"/api/documents/v2/{item.document_id}/pages/{item.page_number}/preview",
    }
