"""add pathway_block.snapshot_json for nested pathway resolution

Revision ID: f66286821872
Revises: 5f1a8b3c9d24
Create Date: 2026-06-02 13:34:56.985918

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "f66286821872"
down_revision: str | None = "5f1a8b3c9d24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable: only populated at publish time for `pathway_link` blocks by
    # the nested-pathway snapshot resolver. Existing rows + concept-status
    # rows stay NULL.
    op.add_column(
        "pathway_block",
        sa.Column("snapshot_json", JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "snapshot_json")
