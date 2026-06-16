"""Add `decision_outputs` + `decision_mode` to `pathway_block` (slot #2 §5).

Slot #2 §5 promotes `DecisionBlock.outputs` from a planned field to
the producer-of-typed-outputs invariant: every decision block
declares a non-empty `outputs` tuple at publish time, and downstream
blocks reference those keys via the `decision_output` predicate
(slot #2 §1.1). `mode` carries the runtime XOR / AND semantics
(slot #3 enforces XOR at execution time).

Backfill: existing decision rows default to `outputs=[]` (forces the
builder to author them before re-publishing) and `mode='and'`. The
publish-time validator rejects empty outputs so the gate stays
fail-closed.

Revision ID: d5e9b21fa1c4
Revises: c4d72f9a8c11
Create Date: 2026-06-09 15:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "d5e9b21fa1c4"
down_revision: str | None = "c4d72f9a8c11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pathway_block",
        sa.Column("decision_outputs", JSONB, nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("decision_mode", sa.String(8), nullable=True),
    )
    op.execute(
        """
        UPDATE pathway_block
        SET decision_outputs = '[]'::jsonb,
            decision_mode = 'and'
        WHERE kind = 'decision'
          AND decision_outputs IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "decision_mode")
    op.drop_column("pathway_block", "decision_outputs")
