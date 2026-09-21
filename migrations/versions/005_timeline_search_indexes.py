"""Timeline/search indexes: columns filtered or sorted on by the Health
Timeline's new type/date filters and Global Search's ilike lookups, none of
which were indexed before this (see src/database/timeline_repository.py and
src/search.py).

Revision ID: 005_timeline_search_indexes
Revises: 004_medications
Create Date: 2026-09-20
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "005_timeline_search_indexes"
down_revision: Union[str, None] = "004_medications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_documents_confirmed", "documents", ["confirmed"])
    op.create_index("ix_documents_report_date", "documents", ["report_date"])
    op.create_index(
        "ix_medication_records_confirmed_at", "medication_records", ["confirmed_at"]
    )
    op.create_index(
        "ix_medication_records_medication_name", "medication_records", ["medication_name"]
    )
    op.create_index("ix_lab_observations_test_name", "lab_observations", ["test_name"])
    op.create_index(
        "ix_imaging_studies_verification_status", "imaging_studies", ["verification_status"]
    )
    op.create_index(
        "ix_imaging_report_sections_verification_status",
        "imaging_report_sections",
        ["verification_status"],
    )


def downgrade() -> None:
    op.drop_index("ix_imaging_report_sections_verification_status", "imaging_report_sections")
    op.drop_index("ix_imaging_studies_verification_status", "imaging_studies")
    op.drop_index("ix_lab_observations_test_name", "lab_observations")
    op.drop_index("ix_medication_records_medication_name", "medication_records")
    op.drop_index("ix_medication_records_confirmed_at", "medication_records")
    op.drop_index("ix_documents_report_date", "documents")
    op.drop_index("ix_documents_confirmed", "documents")
