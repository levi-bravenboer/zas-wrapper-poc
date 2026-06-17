"""add mdo_outcomes to pathway_block

Revision ID: md0outc0me01
Revises: 74823e470ade
Create Date: 2026-06-17 02:00:00.000000

Authored outcome choices for an MDO block (§6b.5) — the leading caregiver
picks one at close.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "md0outc0me01"
down_revision: str | None = "74823e470ade"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("pathway_block", sa.Column("mdo_outcomes", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("pathway_block", "mdo_outcomes")
