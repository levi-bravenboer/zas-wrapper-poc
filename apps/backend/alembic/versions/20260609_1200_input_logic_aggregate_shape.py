"""Promote `pathway_block.input_logic` from slot #1 stub list to slot #2 aggregate dict.

Slot #1 (`pathway-model-foundations`) reserved the column with a bare
`'[]'::jsonb` default, matching the placeholder `list[dict[str, Any]]`
shape on `BaseBlock`. Slot #2 (`pathway-input-logic-and-timing`)
promotes the field to the typed `InputLogic` aggregate
(`{"rules": [...], "aggregator": "all_of"}`); this revision migrates
every existing row in-place and resets the server default to the new
shape so newly inserted rows materialise as `InputLogic()` without
mapper coercion.

Revision ID: a3c1d8b5e012
Revises: 9b1e3c4a52d1
Create Date: 2026-06-09 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "a3c1d8b5e012"
down_revision: str | None = "9b1e3c4a52d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_NEW_DEFAULT_SQL = "'{\"rules\": [], \"aggregator\": \"all_of\"}'::jsonb"
_OLD_DEFAULT_SQL = "'[]'::jsonb"


def upgrade() -> None:
    # Rewrite every existing row to the new aggregate shape. Empty
    # legacy lists collapse to the canonical empty aggregate; any
    # non-empty list is wrapped under `rules` so authored data
    # survives the slot transition even though slot #1 shipped no
    # production authoring path for it.
    op.execute(
        """
        UPDATE pathway_block
        SET input_logic = jsonb_build_object(
            'rules', CASE
                WHEN jsonb_typeof(input_logic) = 'array' THEN input_logic
                ELSE COALESCE(input_logic->'rules', '[]'::jsonb)
            END,
            'aggregator', COALESCE(input_logic->>'aggregator', 'all_of')
        )
        WHERE input_logic IS NULL
           OR jsonb_typeof(input_logic) <> 'object'
           OR NOT (input_logic ? 'rules')
           OR NOT (input_logic ? 'aggregator')
        """
    )

    op.alter_column(
        "pathway_block",
        "input_logic",
        server_default=sa.text(_NEW_DEFAULT_SQL),
    )


def downgrade() -> None:
    # Flatten back to the slot #1 list-of-rules stub. Aggregator hint
    # is intentionally lost — slot #1 has no field for it.
    op.execute(
        """
        UPDATE pathway_block
        SET input_logic = COALESCE(input_logic->'rules', '[]'::jsonb)
        WHERE jsonb_typeof(input_logic) = 'object'
        """
    )
    op.alter_column(
        "pathway_block",
        "input_logic",
        server_default=sa.text(_OLD_DEFAULT_SQL),
    )
