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
