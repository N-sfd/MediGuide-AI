from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.database.models import ImagingReportSection, ImagingStudy


def serialize_study(study: ImagingStudy) -> dict[str, Any]:
    return {
        "study_id": study.id,
        "modality": study.modality,
        "body_region": study.body_region,
        "study_description": study.study_description,
        "study_date": study.study_date.isoformat() if study.study_date else None,
        "institution": study.institution,
        "report_document_id": study.report_document_id,
        "verification_status": study.verification_status,
        "created_at": study.created_at.isoformat() if study.created_at else None,
    }


def serialize_section(section: ImagingReportSection) -> dict[str, Any]:
    return {
        "section_id": section.id,
        "study_id": section.study_id,
        "document_id": section.document_id,
        "section_type": section.section_type,
        "section_text": section.section_text,
        "original_text": section.original_text,
        "page_number": section.page_number,
        "source_text": section.source_text,
        "verification_status": section.verification_status,
    }


def create_study(
    session: Session,
    *,
    modality: str,
    body_region: str = "",
    study_description: str = "",
    study_date: date | None = None,
    institution: str = "",
    accession_identifier: str = "",
) -> ImagingStudy:
    study = ImagingStudy(
        modality=modality,
        body_region=body_region,
        study_description=study_description,
        study_date=study_date,
        institution=institution,
        accession_identifier=accession_identifier,
    )
    session.add(study)
    session.flush()
    return study


def get_study(session: Session, study_id: str) -> ImagingStudy | None:
    return session.get(ImagingStudy, study_id)


def list_studies(
    session: Session,
    *,
    modality: str | None = None,
    body_region: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[ImagingStudy]:
    stmt = select(ImagingStudy)
    if modality:
        stmt = stmt.where(ImagingStudy.modality == modality)
    if body_region:
        stmt = stmt.where(ImagingStudy.body_region.ilike(f"%{body_region}%"))
    if date_from:
        stmt = stmt.where(ImagingStudy.study_date >= date_from)
    if date_to:
        stmt = stmt.where(ImagingStudy.study_date <= date_to)
    stmt = stmt.order_by(ImagingStudy.study_date.desc().nulls_last())
    return list(session.execute(stmt).scalars().all())


def modality_summary(session: Session) -> list[dict[str, Any]]:
    rows = session.execute(
        select(
            ImagingStudy.modality,
            func.count(ImagingStudy.id),
            func.max(ImagingStudy.study_date),
        ).group_by(ImagingStudy.modality)
    ).all()
    return [
        {
            "modality": modality,
            "study_count": count,
            "latest_study_date": latest.isoformat() if latest else None,
        }
        for modality, count, latest in rows
    ]


def delete_study(session: Session, study_id: str) -> bool:
    """Deletes the study and its sections only — the underlying shared
    Document (the uploaded report file) is never deleted by this call."""
    study = session.get(ImagingStudy, study_id)
    if study is None:
        return False
    session.delete(study)
    session.flush()
    return True


def set_study_report_document(session: Session, study_id: str, document_id: str) -> None:
    study = session.get(ImagingStudy, study_id)
    if study is not None:
        study.report_document_id = document_id
        study.pending_report_document_id = None
        session.flush()


def set_pending_report_document(session: Session, study_id: str, document_id: str | None) -> None:
    """Marks (or clears) the in-flight report-upload attempt for a study —
    see ImagingStudy.pending_report_document_id's docstring."""
    study = session.get(ImagingStudy, study_id)
    if study is not None:
        study.pending_report_document_id = document_id
        session.flush()


def set_study_verification_status(session: Session, study_id: str, status: str) -> None:
    study = session.get(ImagingStudy, study_id)
    if study is not None:
        study.verification_status = status
        session.flush()


def upsert_report_sections(
    session: Session,
    *,
    study_id: str,
    document_id: str,
    sections: dict[str, str],
    page_number: int,
    extractor_version: str,
    source_text: str = "",
) -> list[ImagingReportSection]:
    """Replaces this document's extracted (unverified) sections in place —
    a retried/re-run extraction updates the same rows rather than
    accumulating duplicates, matching uq_imaging_report_section."""
    existing = {
        row.section_type: row
        for row in session.execute(
            select(ImagingReportSection).where(ImagingReportSection.document_id == document_id)
        ).scalars().all()
    }

    result: list[ImagingReportSection] = []
    for section_type, text in sections.items():
        row = existing.get(section_type)
        if row is None:
            row = ImagingReportSection(
                study_id=study_id,
                document_id=document_id,
                section_type=section_type,
            )
            session.add(row)
        row.section_text = text
        row.original_text = text
        row.page_number = page_number
        row.source_text = source_text or text
        row.verification_status = "unverified"
        row.extractor_version = extractor_version
        result.append(row)

    session.flush()
    return result


def get_report_sections(session: Session, document_id: str) -> list[ImagingReportSection]:
    return list(
        session.execute(
            select(ImagingReportSection)
            .where(ImagingReportSection.document_id == document_id)
            .order_by(ImagingReportSection.section_type)
        ).scalars().all()
    )


def confirm_report_sections(
    session: Session,
    *,
    document_id: str,
    edits: dict[str, str],
    confirm_types: set[str] | None = None,
) -> list[ImagingReportSection]:
    """Applies user edits (if any) and marks the reviewed sections confirmed.
    The original extracted text (original_text) is never overwritten,
    mirroring the extracted_value/confirmed_value discipline used for lab
    fields. `confirm_types=None` confirms every section (the original
    all-or-nothing behavior); a given set confirms only those section types,
    leaving the rest at their current status so a report can be verified
    incrementally without ever auto-confirming sections the user hasn't
    actually reviewed."""
    rows = get_report_sections(session, document_id)
    for row in rows:
        if row.section_type in edits:
            row.section_text = edits[row.section_type]
        if confirm_types is None or row.section_type in confirm_types:
            row.verification_status = "confirmed"
    session.flush()
    return rows


def derive_study_verification_status(rows: list[ImagingReportSection]) -> str:
    """Study-level status is a pure function of its sections' own
    verification_status: verified only once every section is confirmed,
    partially_verified once some (but not all) are, unverified otherwise."""
    if not rows:
        return "unverified"
    confirmed = sum(1 for row in rows if row.verification_status == "confirmed")
    if confirmed == len(rows):
        return "verified"
    if confirmed > 0:
        return "partially_verified"
    return "unverified"
