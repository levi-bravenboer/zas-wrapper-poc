"""drop milestone and wait block columns (blocks removed)

Revision ID: d1r0pmw8blk0
Revises: cab2e2caecfa
Create Date: 2026-06-16 22:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d1r0pmw8blk0"
down_revision: str | None = "cab2e2caecfa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    "milestone_label",
    "milestone_description",
    "milestone_icon",
    "wait_event_type",
    "wait_source_block_id",
    "wait_timeout_days",
    "wait_on_timeout",
)


def upgrade() -> None:
    for col in _COLUMNS:
        op.drop_column("pathway_block", col)


def downgrade() -> None:
    op.add_column(
        "pathway_block", sa.Column("milestone_label", sa.String(length=255), nullable=True)
    )
    op.add_column("pathway_block", sa.Column("milestone_description", sa.Text(), nullable=True))
    op.add_column("pathway_block", sa.Column("milestone_icon", sa.String(length=64), nullable=True))
    op.add_column(
        "pathway_block", sa.Column("wait_event_type", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "pathway_block",
        sa.Column("wait_source_block_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("pathway_block", sa.Column("wait_timeout_days", sa.Integer(), nullable=True))
    op.add_column(
        "pathway_block", sa.Column("wait_on_timeout", sa.String(length=16), nullable=True)
    )
