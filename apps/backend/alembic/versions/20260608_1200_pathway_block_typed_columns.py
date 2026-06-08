"""pathway_block typed columns + kind discriminator (foundations chain #1)

Adds the discriminator + per-kind nullable columns introduced by the
`pathway-model-foundations` change. Columns are added in-place on the
existing `pathway_block` table; no rename, so the four FKs that point
at `pathway_block.id` remain valid.

Backfill populates `kind` and the per-kind columns from each existing
row's `(type, config)`. Legacy `type` / `config` / `label` columns stay
intact and are dropped in chain slot #2
(`pathway-input-logic-and-timing`).

Revision ID: 9b1e3c4a52d1
Revises: e5f48e021dbe
Create Date: 2026-06-08 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID


revision: str = "9b1e3c4a52d1"
down_revision: str | None = "e5f48e021dbe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Per-kind column catalogue. Each entry is (column_name, sqlalchemy_type,
# extra kwargs). Names are kind-prefixed to avoid collisions with the
# existing `pathway_block.label` display column and across kinds.
_PER_KIND_COLUMNS: list[tuple[str, sa.types.TypeEngine[object], dict[str, object]]] = [
    # --- appointment ---
    ("appointment_title", sa.String(255), {}),
    ("appointment_mode", sa.String(16), {}),
    ("appointment_location", sa.String(255), {}),
    ("appointment_duration_minutes", sa.Integer(), {}),
    ("appointment_attendees_patient", sa.Boolean(), {}),
    ("appointment_notes", sa.Text(), {}),
    # --- task ---
    ("task_title", sa.String(255), {}),
    ("task_assignee", sa.String(16), {}),
    ("task_due_offset_days", sa.Integer(), {}),
    ("task_requires_completion", sa.Boolean(), {}),
    ("task_notes", sa.Text(), {}),
    # --- decision ---
    ("decision_question", sa.String(500), {}),
    ("decision_auto_resolve", JSONB(), {}),
    # --- message ---
    ("message_channel", sa.String(16), {}),
    ("message_subject", sa.String(255), {}),
    ("message_body", sa.Text(), {}),
    ("message_cta_label", sa.String(64), {}),
    ("message_cta_target", sa.String(1024), {}),
    # --- form ---
    ("form_title", sa.String(255), {}),
    ("form_intro", sa.Text(), {}),
    ("form_questions", JSONB(), {}),
    ("form_submit_label", sa.String(64), {}),
    ("form_confirmation_message", sa.Text(), {}),
    # --- milestone ---
    ("milestone_label", sa.String(255), {}),
    ("milestone_description", sa.Text(), {}),
    ("milestone_icon", sa.String(64), {}),
    # --- wait ---
    ("wait_event_type", sa.String(64), {}),
    ("wait_source_block_id", PG_UUID(as_uuid=True), {}),
    ("wait_timeout_days", sa.Integer(), {}),
    ("wait_on_timeout", sa.String(16), {}),
    # --- pathway_link ---
    ("pathway_link_target_pathway_id", PG_UUID(as_uuid=True), {}),
    ("pathway_link_mode", sa.String(32), {}),
    ("pathway_link_version_pin", sa.String(32), {}),
    ("pathway_link_pinned_version_id", PG_UUID(as_uuid=True), {}),
    ("pathway_link_context_mapping", JSONB(), {}),
    # --- external_program ---
    ("external_program_provider", sa.String(32), {}),
    ("external_program_program_id", sa.String(128), {}),
    ("external_program_protocol_id", sa.String(128), {}),
    ("external_program_mode", sa.String(32), {}),
]


def upgrade() -> None:
    # Discriminator. Nullable for the transition window — populated by
    # backfill below, then promoted to NOT NULL in chain slot #2 after
    # every consumer migrates off `type`.
    op.add_column("pathway_block", sa.Column("kind", sa.String(32), nullable=True))
    op.create_index("ix_pathway_block_kind", "pathway_block", ["kind"])

    # Stub columns for chain slot #2 (`pathway-input-logic-and-timing`).
    # `input_logic` defaults to empty list so reads through the new ORM
    # don't have to handle NULL.
    op.add_column(
        "pathway_block",
        sa.Column(
            "input_logic",
            JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column("pathway_block", sa.Column("timing_policy", JSONB(), nullable=True))

    # Per-kind nullable columns.
    for name, type_, kwargs in _PER_KIND_COLUMNS:
        op.add_column("pathway_block", sa.Column(name, type_, nullable=True, **kwargs))

    # --- Backfill ---
    # 1. Discriminator: 1:1 from `type`, with the only legacy dotted code
    #    `luscii.program` collapsing to the new `external_program` kind.
    op.execute(
        """
        UPDATE pathway_block
        SET kind = CASE
            WHEN type = 'luscii.program' THEN 'external_program'
            ELSE type
        END
        WHERE kind IS NULL
        """
    )

    # 2. Per-kind columns from `config` JSONB. Each kind reads its own
    #    config keys via `->>` (text) or typed casts. Keys that are
    #    absent in `config` stay NULL — domain layer treats them as
    #    unset.
    op.execute(
        """
        UPDATE pathway_block SET
            appointment_title = config->>'title',
            appointment_mode = config->>'mode',
            appointment_location = config->>'location',
            appointment_duration_minutes = NULLIF(config->>'duration_minutes', '')::int,
            appointment_attendees_patient = NULLIF(config->>'attendees_patient', '')::boolean,
            appointment_notes = config->>'notes'
        WHERE kind = 'appointment'
        """
    )

    op.execute(
        """
        UPDATE pathway_block SET
            task_title = config->>'title',
            task_assignee = config->>'assignee',
            task_due_offset_days = NULLIF(config->>'due_offset_days', '')::int,
            task_requires_completion = NULLIF(config->>'requires_completion', '')::boolean,
            task_notes = config->>'notes'
        WHERE kind = 'task'
        """
    )

    op.execute(
        """
        UPDATE pathway_block SET
            decision_question = config->>'question',
            decision_auto_resolve = config->'auto_resolve'
        WHERE kind = 'decision'
        """
    )

    op.execute(
        """
        UPDATE pathway_block SET
            message_channel = config->>'channel',
            message_subject = config->>'subject',
            message_body = config->>'body',
            message_cta_label = config->>'cta_label',
            message_cta_target = config->>'cta_target'
        WHERE kind = 'message'
        """
    )

    op.execute(
        """
        UPDATE pathway_block SET
            form_title = config->>'title',
            form_intro = config->>'intro',
            form_questions = config->'questions',
            form_submit_label = config->>'submit_label',
            form_confirmation_message = config->>'confirmation_message'
        WHERE kind = 'form'
        """
    )

    op.execute(
        """
        UPDATE pathway_block SET
            milestone_label = config->>'label',
            milestone_description = config->>'description',
            milestone_icon = config->>'icon'
        WHERE kind = 'milestone'
        """
    )

    op.execute(
        """
        UPDATE pathway_block SET
            wait_event_type = config->>'event_type',
            wait_source_block_id = NULLIF(config->>'source_block_id', '')::uuid,
            wait_timeout_days = NULLIF(config->>'timeout_days', '')::int,
            wait_on_timeout = config->>'on_timeout'
        WHERE kind = 'wait'
        """
    )

    op.execute(
        """
        UPDATE pathway_block SET
            pathway_link_target_pathway_id = NULLIF(config->>'target_pathway_id', '')::uuid,
            pathway_link_mode = config->>'mode',
            pathway_link_version_pin = config->>'version_pin',
            pathway_link_pinned_version_id = NULLIF(config->>'pinned_version_id', '')::uuid,
            pathway_link_context_mapping = config->'context_mapping'
        WHERE kind = 'pathway_link'
        """
    )

    # external_program: provider hard-coded to 'luscii' (only vendor today).
    op.execute(
        """
        UPDATE pathway_block SET
            external_program_provider = 'luscii',
            external_program_program_id = config->>'program_id',
            external_program_protocol_id = config->>'protocol_id',
            external_program_mode = config->>'mode'
        WHERE kind = 'external_program'
        """
    )


def downgrade() -> None:
    for name, _, _ in reversed(_PER_KIND_COLUMNS):
        op.drop_column("pathway_block", name)
    op.drop_column("pathway_block", "timing_policy")
    op.drop_column("pathway_block", "input_logic")
    op.drop_index("ix_pathway_block_kind", table_name="pathway_block")
    op.drop_column("pathway_block", "kind")
