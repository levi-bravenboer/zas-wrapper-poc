"""make collaboration patient_id optional

Revision ID: f0b2d4c6e8a1
Revises: e8a0c2d4f6b9
Create Date: 2026-06-16 17:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f0b2d4c6e8a1"
down_revision: str | None = "e8a0c2d4f6b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A note/attachment owner (e.g. a task) need not be linked to a patient.
    op.alter_column("notes", "patient_id", existing_type=sa.UUID(), nullable=True)
    op.alter_column("attachments", "patient_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    op.alter_column("attachments", "patient_id", existing_type=sa.UUID(), nullable=False)
    op.alter_column("notes", "patient_id", existing_type=sa.UUID(), nullable=False)
