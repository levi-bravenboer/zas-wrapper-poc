"""merge runtime + collaboration heads; add execution completed_by

Revision ID: c0mpl3t3dby1
Revises: f0b2d4c6e8a1, r3l2d4t3tm01
Create Date: 2026-06-17 10:00:00.000000

Reconciles the two alembic heads that diverged when
`feat/split-appointments-and-tasks` merged into the pathway-runtime
branch, adds the §6.4 caregiver-attribution columns to
`pathway_block_execution`, and extends the `owner_type` collaboration
enum with `pathway_step` (notes/files on a pathway step).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "c0mpl3t3dby1"
down_revision: tuple[str, ...] = ("f0b2d4c6e8a1", "r3l2d4t3tm01")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so
    # bracket it with COMMIT/BEGIN (mirrors the `role` enum extension).
    op.execute(sa.text("COMMIT"))
    op.execute(sa.text("ALTER TYPE owner_type ADD VALUE IF NOT EXISTS 'pathway_step'"))
    op.execute(sa.text("BEGIN"))

    op.add_column(
        "pathway_block_execution",
        sa.Column("completed_by", PG_UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "pathway_block_execution",
        sa.Column("completed_by_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pathway_block_execution", "completed_by_name")
    op.drop_column("pathway_block_execution", "completed_by")
