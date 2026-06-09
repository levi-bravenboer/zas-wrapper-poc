"""Add typed `timing_policy_*` columns on `pathway_block` (slot #2 §4).

The slot #2 `TimingPolicy` tagged union replaces the loose
`timing_policy` JSONB with one discriminator column + per-variant
ISO 8601 columns. The JSONB column is retained alongside for the
slot-#2 transition; a follow-up cleanup drops it once every reader
is on the typed columns.

Per spec §4.4 backfill: every existing row defaults to
`WaitAfterPolicy(offset_iso='PT0S')` — "fire as soon as eligible".
The legacy `pathway_timing_value`/`duration_value_id` linkage on the
block row is intentionally left untouched; slot #4 spec only owns
the block-level policy.

Revision ID: c4d72f9a8c11
Revises: b9a4f6e21d4e
Create Date: 2026-06-09 14:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "c4d72f9a8c11"
down_revision: str | None = "b9a4f6e21d4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pathway_block",
        sa.Column("timing_policy_kind", sa.String(32), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("timing_offset_iso", sa.String(63), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("timing_window_iso", sa.String(63), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("timing_duration_iso", sa.String(63), nullable=True),
    )

    # Backfill: every existing row carries no authored timing today
    # (the legacy `duration_value_id` linkage stays separate). Default
    # to `WaitAfterPolicy(PT0S)` so the typed-read path always
    # materialises a concrete policy instead of `None`.
    op.execute(
        """
        UPDATE pathway_block
        SET timing_policy_kind = 'wait_after',
            timing_offset_iso = 'PT0S'
        WHERE timing_policy_kind IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "timing_duration_iso")
    op.drop_column("pathway_block", "timing_window_iso")
    op.drop_column("pathway_block", "timing_offset_iso")
    op.drop_column("pathway_block", "timing_policy_kind")
