"""Add imaging_findings table for Phase 4 structured radiology findings.

Revision ID: 007_imaging_findings
Revises: 006_processing_job_retry_progress
Create Date: 2026-09-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_imaging_findings"
down_revision: Union[str, None] = "006_processing_job_retry_progress"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "imaging_findings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("study_id", sa.String(length=36), nullable=False),
        sa.Column("report_section_id", sa.String(length=36), nullable=True),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("section_type", sa.String(length=32), nullable=False),
        sa.Column("ordinal", sa.Integer(), server_default="0", nullable=False),
        sa.Column("original_text", sa.Text(), server_default="", nullable=False),
        sa.Column("confirmed_text", sa.Text(), server_default="", nullable=False),
        sa.Column("source_text", sa.Text(), server_default="", nullable=False),
        sa.Column("normalized_concept", sa.String(length=256), server_default="", nullable=False),
        sa.Column("anatomy", sa.String(length=256), server_default="", nullable=False),
        sa.Column("laterality", sa.String(length=32), server_default="", nullable=False),
        sa.Column("page_number", sa.Integer(), server_default="1", nullable=False),
        sa.Column("bbox_x", sa.Float(), nullable=True),
        sa.Column("bbox_y", sa.Float(), nullable=True),
        sa.Column("bbox_width", sa.Float(), nullable=True),
        sa.Column("bbox_height", sa.Float(), nullable=True),
        sa.Column("verification_status", sa.String(length=32), server_default="unverified", nullable=False),
        sa.Column("extractor_version", sa.String(length=32), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["study_id"], ["imaging_studies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["report_section_id"], ["imaging_report_sections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("document_id", "section_type", "ordinal", name="uq_imaging_finding_ordinal"),
    )
    op.create_index("ix_imaging_findings_study_id", "imaging_findings", ["study_id"])
    op.create_index("ix_imaging_findings_document_id", "imaging_findings", ["document_id"])
    op.create_index("ix_imaging_findings_report_section_id", "imaging_findings", ["report_section_id"])
    op.create_index("ix_imaging_findings_verification_status", "imaging_findings", ["verification_status"])


def downgrade() -> None:
    op.drop_index("ix_imaging_findings_verification_status", "imaging_findings")
    op.drop_index("ix_imaging_findings_report_section_id", "imaging_findings")
    op.drop_index("ix_imaging_findings_document_id", "imaging_findings")
    op.drop_index("ix_imaging_findings_study_id", "imaging_findings")
    op.drop_table("imaging_findings")
