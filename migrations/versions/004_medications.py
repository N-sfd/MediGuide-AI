"""Medications: minimal persisted record for the Unified Health Timeline.

Revision ID: 004_medications
Revises: 003_imaging
Create Date: 2026-09-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_medications"
down_revision: Union[str, None] = "003_imaging"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "medication_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("medication_name", sa.String(length=256), server_default=""),
        sa.Column("strength", sa.String(length=128), server_default=""),
        sa.Column("form", sa.String(length=128), server_default=""),
        sa.Column("instructions", sa.Text(), server_default=""),
        sa.Column("quantity", sa.String(length=128), server_default=""),
        sa.Column("prescriber_or_pharmacy", sa.String(length=256), server_default=""),
        sa.Column("source", sa.String(length=16), server_default="upload"),
        sa.Column("filename", sa.String(length=512), server_default=""),
        sa.Column("other_visible_text", sa.Text(), server_default=""),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("medication_records")
