"""Processing job retry progress: live "Attempt N of M" state during an
in-flight automatic retry (see src/shared/resilience.py's call_with_retry
on_retry hook and src/database/repository.py's record_retry_progress),
distinct from the existing attempt_count which only tracks manual retries.

Also adds imaging_studies.pending_report_document_id: unlike document
processing (upload and process are separate calls, so the frontend already
holds document_id before polling /status), imaging's report upload+extract
is one call that only returns document_id at the very end — so a poller
keyed by the already-known study_id needs some server-side pointer to the
in-flight (or most recently failed) attempt's document_id to look its
ProcessingJob row up by. Set at the start of an attempt, left in place on
failure (so a status poll can show the failure before "Retry processing" is
clicked), cleared once that attempt succeeds.

Revision ID: 006_processing_job_retry_progress
Revises: 005_timeline_search_indexes
Create Date: 2026-09-21
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_processing_job_retry_progress"
down_revision: Union[str, None] = "005_timeline_search_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "processing_jobs", sa.Column("retry_attempt", sa.Integer(), server_default="0")
    )
    op.add_column(
        "processing_jobs", sa.Column("retry_max", sa.Integer(), server_default="0")
    )
    # SQLite can't ALTER TABLE ADD COLUMN with a foreign key constraint
    # directly — batch mode does the copy-and-move dance Alembic needs for
    # SQLite (op.add_column above has no FK, so it doesn't need this).
    with op.batch_alter_table("imaging_studies") as batch_op:
        batch_op.add_column(sa.Column("pending_report_document_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_imaging_studies_pending_report_document_id",
            "documents",
            ["pending_report_document_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index(
        "ix_imaging_studies_pending_report_document_id",
        "imaging_studies",
        ["pending_report_document_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_imaging_studies_pending_report_document_id", "imaging_studies")
    with op.batch_alter_table("imaging_studies") as batch_op:
        batch_op.drop_constraint(
            "fk_imaging_studies_pending_report_document_id", type_="foreignkey"
        )
        batch_op.drop_column("pending_report_document_id")
    op.drop_column("processing_jobs", "retry_max")
    op.drop_column("processing_jobs", "retry_attempt")
