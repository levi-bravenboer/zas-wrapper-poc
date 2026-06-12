"""add treatment block per-kind columns

Catalogue-expansion § A4: `TreatmentBlock` per-kind nullable columns
on `pathway_block`. Single-table inheritance pattern (slot #1 D2):
`treatment_*` prefix matches the `<KIND>_<field>` mapper convention
in `app/db/models/pathway/block_mapper.py`.

Revision ID: t4r3a1tm2cnt
Revises: a7b3c9e1d4f8
Create Date: 2026-06-12 08:15:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "t4r3a1tm2cnt"
down_revision: str | None = "a7b3c9e1d4f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pathway_block",
        sa.Column("treatment_title", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("treatment_location", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("treatment_duration_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("treatment_notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "treatment_notes")
    op.drop_column("pathway_block", "treatment_duration_minutes")
    op.drop_column("pathway_block", "treatment_location")
    op.drop_column("pathway_block", "treatment_title")
