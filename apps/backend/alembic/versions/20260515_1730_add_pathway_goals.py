"""add pathway clinical_goal + patient_goal

Revision ID: 6175e2c8ebf8
Revises: 20cb594de8b0
Create Date: 2026-05-15 16:41:46.802211

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "6175e2c8ebf8"
down_revision: str | None = "20cb594de8b0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("pathway", sa.Column("clinical_goal", sa.Text(), nullable=True))
    op.add_column("pathway", sa.Column("patient_goal", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("pathway", "patient_goal")
    op.drop_column("pathway", "clinical_goal")
