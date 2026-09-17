"""Cross-domain read for the Unified Health Timeline.

This module deliberately lives outside every single-domain repository
(repository.py, imaging_repository.py, medication_repository.py): it reads
across Document/LabObservation/ImagingStudy/MedicationRecord but owns none
of them, and writes nothing. Every entry it returns is already
verified/confirmed by construction of the tables it reads — see the
per-category comments below — so this module adds no new verification
gate of its own to get wrong.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database.models import Document, ImagingStudy, LabObservation, MedicationRecord

# Reuses the existing modality label mapping rather than duplicating it.
from src.imaging import MODALITY_LABELS

HEADLINE_TEST_CODES = ["hemoglobin_a1c", "glucose"]


def _lab_subtitle(observations: list[LabObservation]) -> str:
    by_code = {obs.test_code: obs for obs in observations}
    chosen = [by_code[code] for code in HEADLINE_TEST_CODES if code in by_code]
    if len(chosen) < 2:
        remaining = [obs for obs in observations if obs.test_code not in HEADLINE_TEST_CODES]
        remaining.sort(key=lambda o: o.test_code)
        chosen.extend(remaining[: 2 - len(chosen)])

    parts = []
    for obs in chosen[:2]:
        value = obs.value_text or (
            f"{obs.value_numeric:g}" if obs.value_numeric is not None else ""
        )
        unit = f" {obs.unit}" if obs.unit else ""
        parts.append(f"{obs.test_name} {value}{unit}".strip())
    return " · ".join(parts)


def _imaging_title(study: ImagingStudy) -> str:
    modality_label = MODALITY_LABELS.get(study.modality, study.modality.upper())
    return f"{modality_label} — {study.body_region}" if study.body_region else modality_label


def get_timeline_entries(session: Session) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []

    # Imaging: verification_status == "verified" is the same gate Imaging
    # Detail itself uses before treating a report as usable.
    imaging_studies = list(
        session.execute(
            select(ImagingStudy).where(
                ImagingStudy.verification_status == "verified",
                ImagingStudy.report_document_id.isnot(None),
            )
        ).scalars().all()
    )
    imaging_document_ids = {study.report_document_id for study in imaging_studies}

    for study in imaging_studies:
        entries.append({
            "entry_id": f"imaging:{study.id}",
            "date": study.study_date.isoformat() if study.study_date else None,
            "category": "imaging",
            "title": _imaging_title(study),
            "subtitle": "",
            "verification_label": "Verified report",
            "verified": True,
            "link": {"type": "imaging_study", "id": study.id},
        })

    # Labs + generic documents: every confirmed Document not already shown
    # as an Imaging entry. LabObservation rows are only ever written with
    # verification_state="confirmed" (upsert_confirmed_document), so their
    # mere presence already means confirmed — no extra filter needed.
    documents = list(
        session.execute(select(Document).where(Document.confirmed.is_(True))).scalars().all()
    )

    for document in documents:
        if document.id in imaging_document_ids:
            continue

        observations = list(
            session.execute(
                select(LabObservation).where(LabObservation.document_id == document.id)
            ).scalars().all()
        )
        date_value = document.report_date.isoformat() if document.report_date else None

        if observations:
            count = len(observations)
            entries.append({
                "entry_id": f"lab:{document.id}",
                "date": date_value,
                "category": "laboratory",
                "title": "Lab Report",
                "subtitle": _lab_subtitle(observations),
                "verification_label": f"{count} verified measurement{'s' if count != 1 else ''}",
                "verified": True,
                "link": {"type": "document", "id": document.id},
            })
        else:
            entries.append({
                "entry_id": f"document:{document.id}",
                "date": date_value,
                "category": "document",
                "title": document.filename or "Document",
                "subtitle": "",
                "verification_label": "Confirmed",
                "verified": True,
                "link": {"type": "document", "id": document.id},
            })

    # Medications: a row only ever exists once confirmed (see
    # medication_workspace.py's confirm()), so presence alone means verified.
    medications = list(session.execute(select(MedicationRecord)).scalars().all())
    for record in medications:
        entries.append({
            "entry_id": f"medication:{record.id}",
            "date": record.confirmed_at.date().isoformat() if record.confirmed_at else None,
            "category": "medication",
            "title": "Medication label added" if record.source == "upload" else "Medication added",
            "subtitle": record.medication_name,
            "verification_label": "User verified",
            "verified": True,
            "link": {"type": "medication", "id": record.id},
        })

    # Descending by date, undated entries last: "" sorts before any real
    # ISO date string, so it naturally falls to the end under reverse=True.
    entries.sort(key=lambda entry: entry["date"] or "", reverse=True)
    return entries
