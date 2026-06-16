"""Drop `pathway_edge` table; backfill into `pathway_block.input_logic` (slot #2 §3).

Per `pathway-input-logic-and-timing/tasks.md` §3.1 / §3.2: every
authored edge row becomes an entry in `target.input_logic.rules` with
the `if_done` predicate, except decision-source edges (with a
non-null `source_branch_id`) which use the `decision_output`
predicate referencing the branch label as `output_key`. Edge timing
fields (`delay_value_id`, `time_marker_id`, `offset_*`) are
intentionally dropped — slot #4 (`TimingPolicy`) and slot #3
(runtime BlockExecution) own temporal arithmetic going forward.

The four `pathway_block.id` foreign keys on `pathway_edge` make the
table fully dependent on the block model; dropping it is reversible
only via the legacy slot #1 dump. The downgrade re-creates the
empty `pathway_edge` table for schema parity but does NOT walk
`input_logic` rules back into edge rows (lossy by design — the
forward path is one-way authored-shape → typed-aggregate).

Revision ID: b9a4f6e21d4e
Revises: a3c1d8b5e012
Create Date: 2026-06-09 13:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = "b9a4f6e21d4e"
down_revision: str | None = "a3c1d8b5e012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Backfill: collapse every edge into an `InputLogicRule` on the
    # target block. Decision-source edges (those whose source is
    # rendered via a `pathway_block_branch`) use the
    # `decision_output` predicate with the branch label as the
    # `output_key`. Everything else becomes `if_done`.
    op.execute(
        """
        WITH edge_rules AS (
            SELECT
                e.target_block_id AS block_id,
                CASE
                    WHEN e.source_branch_id IS NOT NULL THEN jsonb_build_object(
                        'node', e.source_block_id::text,
                        'args', jsonb_build_object(
                            'predicate', 'decision_output',
                            'after_block', e.source_block_id::text,
                            'output_key', COALESCE(br.label, '')
                        )
                    )
                    ELSE jsonb_build_object(
                        'node', e.source_block_id::text,
                        'args', jsonb_build_object(
                            'predicate', 'if_done',
                            'after_block', e.source_block_id::text
                        )
                    )
                END AS rule
            FROM pathway_edge e
            LEFT JOIN pathway_block_branch br ON br.id = e.source_branch_id
        ),
        aggregated AS (
            SELECT block_id, jsonb_agg(rule) AS rules
            FROM edge_rules
            GROUP BY block_id
        )
        UPDATE pathway_block AS b
        SET input_logic = jsonb_build_object(
            'rules', COALESCE(b.input_logic->'rules', '[]'::jsonb) || a.rules,
            'aggregator', COALESCE(b.input_logic->>'aggregator', 'all_of')
        )
        FROM aggregated a
        WHERE a.block_id = b.id
        """
    )

    op.drop_table("pathway_edge")


def downgrade() -> None:
    op.create_table(
        "pathway_edge",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", PG_UUID(as_uuid=True), nullable=False),
        sa.Column(
            "pathway_version_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_version.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "source_block_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_block.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "target_block_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_block.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "source_branch_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_block_branch.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "delay_value_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_timing_value.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "time_marker_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_time_marker.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "offset_value_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("pathway_timing_value.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "offset_direction_code",
            sa.String(63),
            sa.ForeignKey("pathway_edge_offset_direction.code", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "source_block_id",
            "target_block_id",
            "source_branch_id",
            name="uq_pathway_edge_source_target_branch",
            postgresql_nulls_not_distinct=True,
        ),
        sa.CheckConstraint(
            "num_nonnulls(delay_value_id, time_marker_id, source_branch_id) <= 1",
            name="ck_pathway_edge_one_timing",
        ),
        sa.CheckConstraint(
            "((time_marker_id IS NULL) = (offset_value_id IS NULL)) "
            "AND ((time_marker_id IS NULL) = (offset_direction_code IS NULL))",
            name="ck_pathway_edge_offset_pair",
        ),
    )
