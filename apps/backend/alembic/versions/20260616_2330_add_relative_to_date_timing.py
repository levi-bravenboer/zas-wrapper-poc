"""add relative_to_date timing columns (named clinical-date timing, D3a)

Revision ID: r3l2d4t3tm01
Revises: p4rt1c1pnt01
Create Date: 2026-06-16 23:30:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "r3l2d4t3tm01"
down_revision: str | None = "p4rt1c1pnt01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pathway_block", sa.Column("timing_date_name", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "pathway_block", sa.Column("timing_direction", sa.String(length=8), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "timing_direction")
    op.drop_column("pathway_block", "timing_date_name")
