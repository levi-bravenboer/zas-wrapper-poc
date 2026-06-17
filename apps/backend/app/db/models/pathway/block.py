# Node on the canvas. `type` validated app-side against the code-owned
# block-type catalogue (D2). `config` is the ONE purposeful jsonb in the
# pathway domain (Naming Exception 1); Pydantic validates it against the
# catalogue's per-type `config_schema` on save. `x` / `y` are canvas
# coordinates persisted as ints.

from __future__ import annotations

from typing import Any, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class PathwayBlock(TenantOwnedEntity):
    __tablename__ = "pathway_block"
    __realtime_resource__: ClassVar[str | None] = None
    # NOT __audited__: block edits are part of pathway authoring, captured as
    # explicit `Pathway`-anchored domain events (OP_EDIT), not row auto-diff.

    pathway_version_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_version.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    phase_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_phase.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    lane_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_lane.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # `label` stores `BaseBlock.name` (the display label on the canvas).
    # The slot-#1 nullability is retained for legacy rows; new writes
    # always populate it via the mapper.
    label: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    duration_value_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("pathway_timing_value.id", ondelete="CASCADE"),
        nullable=True,
    )
    # `type` + `config` legacy columns retired in chain slot #2 §6 —
    # the typed per-kind columns + `kind` discriminator are now the
    # sole source of truth. See alembic revision
    # `20260609_1600_drop_legacy_block_columns.py`.
    # Frozen child reference produced at publish time for blocks whose body
    # is a link to a moving target (today: `pathway_link`). NULL on concept
    # rows, populated by the nested-pathway snapshot resolver when the parent
    # version flips to `published`. Shape:
    #   {"target_pathway_id": uuid, "resolved_version_id": uuid,
    #    "tracking": "specific" | "latest_published"}
    snapshot_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    x: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    y: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))

    # --- Typed-model columns introduced by `pathway-model-foundations` ---
    # `kind` is nullable during the chain-slot-#1 transition; promoted to
    # NOT NULL in chain slot #2 once every legacy `(type, config)` consumer
    # is retired. The mapper layer (`block_mapper.py`) dispatches on this
    # value when materialising rows into typed `BaseBlock` subclasses.
    kind: Mapped[str | None] = mapped_column(sa.String(32), nullable=True, index=True)

    # `input_logic` carries the typed `InputLogic` aggregate per chain
    # slot #2 (§1 / §2). The mapper layer round-trips Pydantic model →
    # JSONB dict. The slot #1 stub default (`'[]'::jsonb`) is migrated
    # in-place to the new aggregate shape via the slot #2 alembic
    # revision so existing rows materialise into `InputLogic()` with
    # the default `all_of` aggregator.
    input_logic: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=sa.text('\'{"rules": [], "aggregator": "all_of"}\'::jsonb'),
    )
    # `timing_policy` JSONB is retained for back-compat; chain slot #2
    # §4 introduces the typed `timing_policy_*` columns below. New
    # writes populate the typed columns; reads dispatch on
    # `timing_policy_kind`. The JSONB column is dropped in a follow-up
    # cleanup once every consumer reads off the typed columns.
    timing_policy: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    timing_policy_kind: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)

    # FHIR action.participant {role, specialty} — round-trips as JSONB via
    # the base-field mapper (like input_logic / timing_policy).
    participant: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    timing_offset_iso: Mapped[str | None] = mapped_column(sa.String(63), nullable=True)
    timing_window_iso: Mapped[str | None] = mapped_column(sa.String(63), nullable=True)
    timing_duration_iso: Mapped[str | None] = mapped_column(sa.String(63), nullable=True)
    # `relative_to_date` timing (D3a): named clinical date + before/after.
    timing_date_name: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    timing_direction: Mapped[str | None] = mapped_column(sa.String(8), nullable=True)

    # --- Per-kind nullable columns (single-table inheritance, mapper-dispatched) ---
    # Prefixed by kind to avoid collisions with each other and with the
    # legacy `label` display column above. Every column is nullable
    # because exactly one kind populates any given row.
    appointment_title: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    appointment_mode: Mapped[str | None] = mapped_column(sa.String(16), nullable=True)
    appointment_location: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    appointment_duration_minutes: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    appointment_attendees_patient: Mapped[bool | None] = mapped_column(sa.Boolean, nullable=True)
    appointment_notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    # Catalogue-expansion § A4: TreatmentBlock per-kind columns
    treatment_title: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    treatment_location: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    treatment_duration_minutes: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    treatment_notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    task_title: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    task_assignee: Mapped[str | None] = mapped_column(sa.String(16), nullable=True)
    task_due_offset_days: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    task_requires_completion: Mapped[bool | None] = mapped_column(sa.Boolean, nullable=True)
    task_notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    decision_question: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    decision_auto_resolve: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # Slot #2 §5: typed outputs the runtime engine fires (`xor` =
    # exactly one, `and` = independent). Stored as JSONB list to
    # preserve ordering; the typed mapper coerces back to tuple on
    # read for the Pydantic field.
    decision_outputs: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    decision_mode: Mapped[str | None] = mapped_column(sa.String(8), nullable=True)

    message_channel: Mapped[str | None] = mapped_column(sa.String(16), nullable=True)
    message_subject: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    message_body: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    message_cta_label: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    message_cta_target: Mapped[str | None] = mapped_column(sa.String(1024), nullable=True)

    # Pathway-completion § A7: MdoBlock per-kind columns
    mdo_topic: Mapped[str | None] = mapped_column(sa.String(500), nullable=True)
    mdo_expected_attendees_note: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    mdo_outcomes: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    # Pathway-completion § A8: InformedConsentBlock per-kind columns
    informed_consent_questions: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True
    )
    informed_consent_channels: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    informed_consent_reminder_offset_iso: Mapped[str | None] = mapped_column(
        sa.String(63), nullable=True
    )
    informed_consent_reminder_max: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    informed_consent_expires_at_iso: Mapped[str | None] = mapped_column(
        sa.String(63), nullable=True
    )

    form_title: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    form_intro: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    form_questions: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    form_submit_label: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    form_confirmation_message: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    pathway_link_target_pathway_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    pathway_link_mode: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    pathway_link_version_pin: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    pathway_link_pinned_version_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    pathway_link_context_mapping: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )

    external_program_provider: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
    external_program_program_id: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    external_program_protocol_id: Mapped[str | None] = mapped_column(sa.String(128), nullable=True)
    external_program_mode: Mapped[str | None] = mapped_column(sa.String(32), nullable=True)
