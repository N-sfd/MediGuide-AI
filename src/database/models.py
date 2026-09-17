from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base


def _uuid() -> str:
    return str(uuid4())


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), default="")
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(64), default="uploaded")
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    report_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    storage_path: Mapped[str] = mapped_column(String(1024), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    pages: Mapped[list[DocumentPage]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentPage.page_number",
    )
    fields: Mapped[list[ExtractedField]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
    lab_observations: Mapped[list[LabObservation]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
    processing_jobs: Mapped[list[ProcessingJob]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )


class DocumentPage(Base):
    __tablename__ = "document_pages"
    __table_args__ = (
        UniqueConstraint("document_id", "page_number", name="uq_document_page"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    preview_path: Mapped[str] = mapped_column(String(1024), default="")
    text_available: Mapped[bool] = mapped_column(Boolean, default=False)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    document: Mapped[Document] = relationship(back_populates="pages")
    fields: Mapped[list[ExtractedField]] = relationship(back_populates="page")


class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    __table_args__ = (
        UniqueConstraint("document_id", "field_id", name="uq_document_field"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    page_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("document_pages.id", ondelete="SET NULL"), nullable=True
    )
    field_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(256), nullable=False)
    value: Mapped[str] = mapped_column(String(512), default="")
    unit: Mapped[str] = mapped_column(String(64), default="")
    reference_range: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(64), default="unknown")
    confidence: Mapped[str] = mapped_column(String(64), default="needs_review")
    page_number: Mapped[int] = mapped_column(Integer, default=1)
    source_text: Mapped[str] = mapped_column(Text, default="")
    extraction_method: Mapped[str] = mapped_column(String(32), default="")
    user_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    user_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    # Reserved for Document Intelligence V2 source highlighting.
    bbox_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_width: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_height: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    document: Mapped[Document] = relationship(back_populates="fields")
    page: Mapped[Optional[DocumentPage]] = relationship(back_populates="fields")
    lab_observation: Mapped[Optional[LabObservation]] = relationship(
        back_populates="field",
        uselist=False,
    )


class ProcessingJob(Base):
    """Tracks one extraction attempt-history row per (document, job_type).

    There is no background task queue in this app — processing still runs
    inside the HTTP request/response cycle — so this table exists purely to
    give retries a durable status/attempt/error record instead of losing
    that information the moment the request ends. Retries update the same
    row (attempt_count increments) rather than inserting a new one, so a
    document never accumulates duplicate job rows.
    """

    __tablename__ = "processing_jobs"
    __table_args__ = (
        UniqueConstraint("document_id", "job_type", name="uq_document_job_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    job_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    stage: Mapped[str] = mapped_column(String(32), default="validating")
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str] = mapped_column(String(64), default="")
    safe_error_message: Mapped[str] = mapped_column(Text, default="")
    technical_error: Mapped[str] = mapped_column(Text, default="")
    retryable: Mapped[bool] = mapped_column(Boolean, default=False)
    processor_version: Mapped[str] = mapped_column(String(32), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    document: Mapped[Document] = relationship(back_populates="processing_jobs")


class LabObservation(Base):
    __tablename__ = "lab_observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    field_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("extracted_fields.id", ondelete="CASCADE"), index=True
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    test_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    test_name: Mapped[str] = mapped_column(String(256), nullable=False)
    value_numeric: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    value_text: Mapped[str] = mapped_column(String(128), default="")
    unit: Mapped[str] = mapped_column(String(64), default="")
    reference_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reference_text: Mapped[str] = mapped_column(String(128), default="")
    report_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    verification_state: Mapped[str] = mapped_column(
        String(32), default="human_verified"
    )
    confidence: Mapped[str] = mapped_column(String(64), default="")
    extraction_method: Mapped[str] = mapped_column(String(32), default="")
    range_status: Mapped[str] = mapped_column(String(64), default="unknown")
    document_name: Mapped[str] = mapped_column(String(512), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    document: Mapped[Document] = relationship(back_populates="lab_observations")
    field: Mapped[ExtractedField] = relationship(back_populates="lab_observation")


class ImagingStudy(Base):
    """An imaging study (X-Ray/CT/MRI/Ultrasound/PET-CT). Organizes and
    displays imaging reports — never a diagnosis of the underlying scan."""

    __tablename__ = "imaging_studies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    modality: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    body_region: Mapped[str] = mapped_column(String(128), default="")
    study_description: Mapped[str] = mapped_column(String(256), default="")
    study_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    institution: Mapped[str] = mapped_column(String(256), default="")
    # Never rendered in normal UI — kept for institutional traceability only.
    accession_identifier: Mapped[str] = mapped_column(String(128), default="")
    report_document_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    verification_status: Mapped[str] = mapped_column(String(32), default="unverified")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    series: Mapped[list[ImagingSeries]] = relationship(
        back_populates="study",
        cascade="all, delete-orphan",
    )
    sections: Mapped[list[ImagingReportSection]] = relationship(
        back_populates="study",
        cascade="all, delete-orphan",
    )


class ImagingSeries(Base):
    """DICOM-shaped series metadata. Not populated without DICOM ingestion
    (see src/imaging_dicom.py) — the table exists so that work is additive
    rather than requiring a later migration."""

    __tablename__ = "imaging_series"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    study_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("imaging_studies.id", ondelete="CASCADE"), index=True
    )
    series_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(String(256), default="")
    image_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    modality: Mapped[str] = mapped_column(String(32), default="")

    study: Mapped[ImagingStudy] = relationship(back_populates="series")


class ImagingReportSection(Base):
    """A section extracted from a radiology report (Exam/Findings/
    Impression/...) — prose, not a measurement, so it is a distinct model
    from ExtractedField rather than a reuse of the lab extraction schema."""

    __tablename__ = "imaging_report_sections"
    __table_args__ = (
        UniqueConstraint("document_id", "section_type", name="uq_imaging_report_section"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    study_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("imaging_studies.id", ondelete="CASCADE"), index=True
    )
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    section_type: Mapped[str] = mapped_column(String(32), nullable=False)
    section_text: Mapped[str] = mapped_column(Text, default="")
    # Never overwritten on edit — same provenance discipline as ExtractedField.
    original_text: Mapped[str] = mapped_column(Text, default="")
    page_number: Mapped[int] = mapped_column(Integer, default=1)
    source_text: Mapped[str] = mapped_column(Text, default="")
    verification_status: Mapped[str] = mapped_column(String(32), default="unverified")
    extractor_version: Mapped[str] = mapped_column(String(32), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    study: Mapped[ImagingStudy] = relationship(back_populates="sections")


class MedicationRecord(Base):
    """A confirmed medication entry — minimal, leaf persistence so
    Medications can appear honestly in the Unified Health Timeline. No
    foreign keys to anything else (mirrors Document standing alone). No
    image/file persistence: the uploaded label image still only lives in
    the temp session dir and expires — a historical record's detail view
    is text-only, and that limitation is surfaced in the UI, not hidden."""

    __tablename__ = "medication_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    medication_name: Mapped[str] = mapped_column(String(256), default="")
    strength: Mapped[str] = mapped_column(String(128), default="")
    form: Mapped[str] = mapped_column(String(128), default="")
    instructions: Mapped[str] = mapped_column(Text, default="")
    quantity: Mapped[str] = mapped_column(String(128), default="")
    prescriber_or_pharmacy: Mapped[str] = mapped_column(String(256), default="")
    source: Mapped[str] = mapped_column(String(16), default="upload")
    filename: Mapped[str] = mapped_column(String(512), default="")
    other_visible_text: Mapped[str] = mapped_column(Text, default="")
    confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
