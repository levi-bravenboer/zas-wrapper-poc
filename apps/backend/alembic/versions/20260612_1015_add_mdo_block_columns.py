"""add mdo block per-kind columns

Pathway-completion § A7: `MdoBlock` per-kind nullable columns on
`pathway_block`. Single-table inheritance pattern (slot #1 D2):
`mdo_*` prefix matches the `<KIND>_<field>` mapper convention in
`app/db/models/pathway/block_mapper.py`.

Revision ID: m4d0b1l0ckk1
Revises: c0n5e4t8b1ck
Create Date: 2026-06-12 10:15:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "m4d0b1l0ckk1"
down_revision: str | None = "c0n5e4t8b1ck"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pathway_block",
        sa.Column("mdo_topic", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("mdo_expected_attendees_note", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "mdo_expected_attendees_note")
    op.drop_column("pathway_block", "mdo_topic")
