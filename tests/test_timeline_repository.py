from __future__ import annotations

from datetime import date

from src.database.models import (
    Document,
    ImagingStudy,
    LabObservation,
    MedicationRecord,
)
from src.database.timeline_repository import get_timeline_entries


def test_empty_database_returns_no_entries(db_session):
    with db_session.session_scope() as session:
        assert get_timeline_entries(session) == []


def test_unconfirmed_document_never_appears(db_session):
    with db_session.session_scope() as session:
        session.add(Document(id="doc-1", filename="draft.pdf", confirmed=False))
    with db_session.session_scope() as session:
        assert get_timeline_entries(session) == []


def test_unverified_imaging_study_never_appears(db_session):
    with db_session.session_scope() as session:
        session.add(Document(id="doc-1", filename="report.pdf", confirmed=True))
        session.add(
            ImagingStudy(
                id="study-1",
                modality="mri",
                report_document_id="doc-1",
                verification_status="unverified",
            )
        )
    with db_session.session_scope() as session:
        entries = get_timeline_entries(session)
    # The document itself is confirmed and has no lab observations, so it
    # still surfaces as a generic Document entry — it just must not also
    # (or instead) appear as an Imaging entry while unverified.
    assert all(entry["category"] != "imaging" for entry in entries)


def test_imaging_report_document_is_not_double_counted(db_session):
    with db_session.session_scope() as session:
        session.add(Document(id="doc-1", filename="mri_report.pdf", confirmed=True))
        session.add(
            ImagingStudy(
                id="study-1",
                modality="mri",
                body_region="Right knee",
                study_date=date(2026, 9, 2),
                report_document_id="doc-1",
                verification_status="verified",
            )
        )
    with db_session.session_scope() as session:
        entries = get_timeline_entries(session)

    assert len(entries) == 1
    assert entries[0]["category"] == "imaging"
    assert entries[0]["title"] == "MRI — Right knee"
    assert entries[0]["link"] == {"type": "imaging_study", "id": "study-1"}
    assert entries[0]["verified"] is True


def test_document_with_lab_observations_becomes_laboratory_entry(db_session):
    with db_session.session_scope() as session:
        session.add(
            Document(
                id="doc-1",
                filename="labs.pdf",
                confirmed=True,
                report_date=date(2026, 8, 12),
            )
        )
        session.add(
            LabObservation(
                document_id="doc-1",
                field_id="00000000-0000-0000-0000-000000000001",
                page_number=1,
                test_code="hemoglobin_a1c",
                test_name="Hemoglobin A1C",
                value_numeric=6.7,
                value_text="6.7",
                unit="%",
                report_date=date(2026, 8, 12),
            )
        )
        session.add(
            LabObservation(
                document_id="doc-1",
                field_id="00000000-0000-0000-0000-000000000002",
                page_number=1,
                test_code="glucose",
                test_name="Glucose",
                value_numeric=108,
                value_text="108",
                unit="mg/dL",
                report_date=date(2026, 8, 12),
            )
        )
    with db_session.session_scope() as session:
        entries = get_timeline_entries(session)

    assert len(entries) == 1
    entry = entries[0]
    assert entry["category"] == "laboratory"
    assert entry["date"] == "2026-08-12"
    assert entry["verification_label"] == "2 verified measurements"
    assert "Hemoglobin A1C" in entry["subtitle"]
    assert "6.7" in entry["subtitle"]
    assert "Glucose" in entry["subtitle"]
    assert entry["link"] == {"type": "document", "id": "doc-1"}


def test_document_without_lab_observations_becomes_generic_document_entry(db_session):
    with db_session.session_scope() as session:
        session.add(
            Document(
                id="doc-1",
                filename="referral.pdf",
                confirmed=True,
                report_date=date(2026, 7, 1),
            )
        )
    with db_session.session_scope() as session:
        entries = get_timeline_entries(session)

    assert len(entries) == 1
    assert entries[0]["category"] == "document"
    assert entries[0]["title"] == "referral.pdf"
    assert entries[0]["verification_label"] == "Confirmed"


def test_medication_record_becomes_medication_entry(db_session):
    with db_session.session_scope() as session:
        session.add(
            MedicationRecord(
                id="med-1",
                medication_name="Amoxicillin",
                strength="500mg",
                source="typed",
            )
        )
    with db_session.session_scope() as session:
        entries = get_timeline_entries(session)

    assert len(entries) == 1
    entry = entries[0]
    assert entry["category"] == "medication"
    assert entry["subtitle"] == "Amoxicillin"
    assert entry["verification_label"] == "User verified"
    assert entry["link"] == {"type": "medication", "id": "med-1"}


def test_entries_sorted_descending_with_undated_last(db_session):
    with db_session.session_scope() as session:
        session.add(Document(id="doc-old", filename="a.pdf", confirmed=True, report_date=date(2025, 1, 1)))
        session.add(Document(id="doc-new", filename="b.pdf", confirmed=True, report_date=date(2026, 9, 1)))
        session.add(Document(id="doc-undated", filename="c.pdf", confirmed=True, report_date=None))
    with db_session.session_scope() as session:
        entries = get_timeline_entries(session)

    assert [e["link"]["id"] for e in entries] == ["doc-new", "doc-old", "doc-undated"]


def test_lab_subtitle_prefers_headline_tests_when_present(db_session):
    with db_session.session_scope() as session:
        session.add(Document(id="doc-1", filename="labs.pdf", confirmed=True, report_date=date(2026, 8, 12)))
        for code, name, value in [
            ("creatinine", "Creatinine", "0.9"),
            ("wbc", "WBC", "6.4"),
            ("hemoglobin_a1c", "Hemoglobin A1C", "6.7"),
            ("glucose", "Glucose", "108"),
        ]:
            session.add(
                LabObservation(
                    document_id="doc-1",
                    field_id=f"field-{code}",
                    page_number=1,
                    test_code=code,
                    test_name=name,
                    value_text=value,
                    report_date=date(2026, 8, 12),
                )
            )
    with db_session.session_scope() as session:
        entries = get_timeline_entries(session)

    subtitle = entries[0]["subtitle"]
    assert "Hemoglobin A1C" in subtitle
    assert "Glucose" in subtitle
    assert "Creatinine" not in subtitle
    assert "WBC" not in subtitle
