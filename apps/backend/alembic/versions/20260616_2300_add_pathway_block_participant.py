"""add pathway_block.participant (FHIR action.participant) JSONB column

Revision ID: p4rt1c1pnt01
Revises: d1r0pmw8blk0
Create Date: 2026-06-16 23:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "p4rt1c1pnt01"
down_revision: str | None = "d1r0pmw8blk0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pathway_block",
        sa.Column("participant", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "participant")
