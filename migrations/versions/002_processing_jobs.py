"""Processing jobs: durable retry/attempt tracking for document extraction.

Revision ID: 002_processing_jobs
Revises: 001_initial_provenance
Create Date: 2026-09-16
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_processing_jobs"
down_revision: Union[str, None] = "001_initial_provenance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(length=36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="queued"),
        sa.Column("stage", sa.String(length=32), server_default="validating"),
        sa.Column("attempt_count", sa.Integer(), server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(length=64), server_default=""),
        sa.Column("safe_error_message", sa.Text(), server_default=""),
        sa.Column("technical_error", sa.Text(), server_default=""),
        sa.Column("retryable", sa.Boolean(), server_default=sa.false()),
        sa.Column("processor_version", sa.String(length=32), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("document_id", "job_type", name="uq_document_job_type"),
    )
    op.create_index("ix_processing_jobs_document_id", "processing_jobs", ["document_id"])


def downgrade() -> None:
    op.drop_table("processing_jobs")
