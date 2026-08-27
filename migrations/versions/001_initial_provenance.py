"""Initial provenance schema: documents → pages → fields → lab observations.

Revision ID: 001_initial_provenance
Revises:
Create Date: 2026-08-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial_provenance"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=128), server_default=""),
        sa.Column("page_count", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(length=64), server_default="uploaded"),
        sa.Column("confirmed", sa.Boolean(), server_default=sa.false()),
        sa.Column("report_date", sa.Date(), nullable=True),
        sa.Column("storage_path", sa.String(length=1024), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "document_pages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("document_id", sa.String(length=36), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("preview_path", sa.String(length=1024), server_default=""),
        sa.Column("text_available", sa.Boolean(), server_default=sa.false()),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.UniqueConstraint("document_id", "page_number", name="uq_document_page"),
    )
    op.create_index("ix_document_pages_document_id", "document_pages", ["document_id"])
    op.create_table(
        "extracted_fields",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("document_id", sa.String(length=36), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_id", sa.String(length=36), sa.ForeignKey("document_pages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("field_id", sa.String(length=64), nullable=False),
        sa.Column("label", sa.String(length=256), nullable=False),
        sa.Column("value", sa.String(length=512), server_default=""),
        sa.Column("unit", sa.String(length=64), server_default=""),
        sa.Column("reference_range", sa.String(length=128), server_default=""),
        sa.Column("status", sa.String(length=64), server_default="unknown"),
        sa.Column("confidence", sa.String(length=64), server_default="needs_review"),
        sa.Column("page_number", sa.Integer(), server_default="1"),
        sa.Column("source_text", sa.Text(), server_default=""),
        sa.Column("user_edited", sa.Boolean(), server_default=sa.false()),
        sa.Column("user_confirmed", sa.Boolean(), server_default=sa.false()),
        sa.Column("bbox_x", sa.Float(), nullable=True),
        sa.Column("bbox_y", sa.Float(), nullable=True),
        sa.Column("bbox_width", sa.Float(), nullable=True),
        sa.Column("bbox_height", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("document_id", "field_id", name="uq_document_field"),
    )
    op.create_index("ix_extracted_fields_document_id", "extracted_fields", ["document_id"])
    op.create_index("ix_extracted_fields_field_id", "extracted_fields", ["field_id"])
    op.create_table(
        "lab_observations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("document_id", sa.String(length=36), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("field_id", sa.String(length=36), sa.ForeignKey("extracted_fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("test_code", sa.String(length=64), nullable=False),
        sa.Column("test_name", sa.String(length=256), nullable=False),
        sa.Column("value_numeric", sa.Float(), nullable=True),
        sa.Column("value_text", sa.String(length=128), server_default=""),
        sa.Column("unit", sa.String(length=64), server_default=""),
        sa.Column("reference_low", sa.Float(), nullable=True),
        sa.Column("reference_high", sa.Float(), nullable=True),
        sa.Column("reference_text", sa.String(length=128), server_default=""),
        sa.Column("report_date", sa.Date(), nullable=True),
        sa.Column("verification_state", sa.String(length=32), server_default="human_verified"),
        sa.Column("document_name", sa.String(length=512), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_lab_observations_document_id", "lab_observations", ["document_id"])
    op.create_index("ix_lab_observations_field_id", "lab_observations", ["field_id"])
    op.create_index("ix_lab_observations_test_code", "lab_observations", ["test_code"])
    op.create_index("ix_lab_observations_report_date", "lab_observations", ["report_date"])


def downgrade() -> None:
    op.drop_table("lab_observations")
    op.drop_table("extracted_fields")
    op.drop_table("document_pages")
    op.drop_table("documents")
