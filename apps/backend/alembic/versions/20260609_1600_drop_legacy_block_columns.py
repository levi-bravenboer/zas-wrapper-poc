"""Drop legacy `pathway_block.type` + `config` columns (slot #2 §6.3).

Slot #1 dual-wrote `(type, config, label)` alongside the typed
per-kind columns so the builder UI could keep authoring the legacy
shape during the transition. Slot #2 §6 retires the dual-write: the
typed `kind` discriminator + per-kind columns + `input_logic` JSONB
are the sole source of truth. `label` stays as the storage column
for `BaseBlock.name`; `type` and `config` are removed.

The downgrade re-creates the columns with permissive defaults but
does NOT reconstruct their contents from the typed columns (lossy
by design — slot #1 backfill was one-way).

Revision ID: e6f1a2d4c7b8
Revises: d5e9b21fa1c4
Create Date: 2026-06-09 16:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "e6f1a2d4c7b8"
down_revision: str | None = "d5e9b21fa1c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Promote `kind` to NOT NULL — the slot-#1 backfill populated
    # every row; any straggler that still has NULL fails the publish
    # gate per slot #2 §6.
    op.execute("UPDATE pathway_block SET kind = type WHERE kind IS NULL")
    op.alter_column("pathway_block", "kind", nullable=False)

    op.drop_column("pathway_block", "config")
    op.drop_column("pathway_block", "type")


def downgrade() -> None:
    op.add_column(
        "pathway_block",
        sa.Column(
            "type",
            sa.String(63),
            nullable=False,
            server_default="appointment",
        ),
    )
    op.add_column(
        "pathway_block",
        sa.Column(
            "config",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.alter_column("pathway_block", "kind", nullable=True)
