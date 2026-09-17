"""Imaging workspace: studies, series, and report sections.

Revision ID: 003_imaging
Revises: 002_processing_jobs
Create Date: 2026-09-16
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_imaging"
down_revision: Union[str, None] = "002_processing_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "imaging_studies",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("modality", sa.String(length=32), nullable=False),
        sa.Column("body_region", sa.String(length=128), server_default=""),
        sa.Column("study_description", sa.String(length=256), server_default=""),
        sa.Column("study_date", sa.Date(), nullable=True),
        sa.Column("institution", sa.String(length=256), server_default=""),
        sa.Column("accession_identifier", sa.String(length=128), server_default=""),
        sa.Column(
            "report_document_id",
            sa.String(length=36),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("verification_status", sa.String(length=32), server_default="unverified"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_imaging_studies_modality", "imaging_studies", ["modality"])
    op.create_index("ix_imaging_studies_study_date", "imaging_studies", ["study_date"])

    op.create_table(
        "imaging_series",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "study_id",
            sa.String(length=36),
            sa.ForeignKey("imaging_studies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("series_number", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=256), server_default=""),
        sa.Column("image_count", sa.Integer(), nullable=True),
        sa.Column("modality", sa.String(length=32), server_default=""),
    )
    op.create_index("ix_imaging_series_study_id", "imaging_series", ["study_id"])

    op.create_table(
        "imaging_report_sections",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "study_id",
            sa.String(length=36),
            sa.ForeignKey("imaging_studies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.String(length=36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section_type", sa.String(length=32), nullable=False),
        sa.Column("section_text", sa.Text(), server_default=""),
        sa.Column("original_text", sa.Text(), server_default=""),
        sa.Column("page_number", sa.Integer(), server_default="1"),
        sa.Column("source_text", sa.Text(), server_default=""),
        sa.Column("verification_status", sa.String(length=32), server_default="unverified"),
        sa.Column("extractor_version", sa.String(length=32), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("document_id", "section_type", name="uq_imaging_report_section"),
    )
    op.create_index(
        "ix_imaging_report_sections_study_id", "imaging_report_sections", ["study_id"]
    )
    op.create_index(
        "ix_imaging_report_sections_document_id", "imaging_report_sections", ["document_id"]
    )


def downgrade() -> None:
    op.drop_table("imaging_report_sections")
    op.drop_table("imaging_series")
    op.drop_table("imaging_studies")
