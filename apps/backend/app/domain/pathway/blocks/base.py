"""BaseBlock — typed class hierarchy for pathway blocks.

Replaces the data-driven `BlockTypeEntry` registry (`_base.py`) per the
decisions in `openspec/changes/pathway-model-redesign/design.md`:

- **D1**: SQLAlchemy single-table inheritance maps every subclass to one
  wide `pathway_block` table with a `kind` discriminator. Domain layer
  here owns the typed shape; storage mapping lives in `app/db/models/pathway/`.
- **D4**: Deferred fields are declared via a class-level
  `DEFERRED_FIELDS: tuple[DeferredFieldSpec, ...]` attribute.
- **D7**: Lane-kind invariant is declared on the class via
  `allowed_lane_kinds`; instance still carries `lane_id` for canvas
  placement (publish-time validator enforces membership).

`input_logic` and `timing_policy` are stub fields on `BaseBlock` for chain
slot #1 — populated and made authoritative in chain slot #2
(`pathway-input-logic-and-timing`).

The retired `BlockTypeEntry` data registry remains importable during the
chain-slot-#1 transition; see `_base.py`. A shim that resolves a legacy
`type: str` to the right `BaseBlock` subclass lives in
`app/domain/pathway/blocks/__init__.py` and is removed once every consumer
has migrated.
"""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict

from app.domain.pathway.blocks.deferred import DeferredFieldSpec
from app.domain.pathway.input_logic import InputLogic
from app.domain.pathway.participant import ParticipantSpec
from app.domain.pathway.timing import TimingPolicy
from app.schemas.pathway.blocks import BlockSourceLiteral, NestedRenderLiteral


FieldMode = Literal["always_static", "builder_choice", "always_deferred"]


class BaseBlock(BaseModel):
    """Abstract root for every pathway block kind.

    Concrete subclasses (one per kind) live under
    `app/domain/pathway/blocks/<kind>/block.py` and declare:

    - the per-kind discriminator value via `KIND`
    - per-kind class metadata (`LABEL`, `DESCRIPTION`, `ICON`,
      `allowed_lane_kinds`, `EVENTS`, `RESULT_TYPE`, `FIELD_MODES`,
      `DEFERRED_FIELDS`, `SOURCE`)
    - typed instance fields (e.g. `AppointmentBlock.location`)

    Subclasses MUST set `KIND` to a unique non-empty string used as the
    SQLAlchemy polymorphic identity on `pathway_block.kind`.
    """

    model_config = ConfigDict(extra="forbid", frozen=False, populate_by_name=True)

    # --- INSTANCE: authored per block on the canvas ---
    # Display label for the block on the canvas. Replaces the ORM-level
    # `pathway_block.label` field in the new model.
    name: str

    # Optional override of the lane-kind code when the subclass allows more
    # than one kind. When unset, the block adopts the kind of its placed
    # `lane_id`. Subclasses with a single allowed kind ignore this.
    lane_kind: str | None = None

    # `input_logic` is the typed eligibility aggregate per chain slot #2
    # (D2 + D3): replaces the authored `pathway_edge` table as the
    # single source of truth for inter-block connectivity. Every
    # downstream block enumerates its upstream gates via typed
    # `InputLogicRule` entries; canvas derives edges from this on read.
    # Default empty aggregate = unconditionally eligible (no upstream
    # dependency).
    input_logic: InputLogic = InputLogic()

    # `timing_policy` is the tagged-union timing model per chain
    # slot #2 §4 (D5). `None` means "no authored timing on this
    # block"; the mapper writes the discriminated union to JSONB and
    # round-trips through `model_validate` on read.
    timing_policy: TimingPolicy | None = None

    # FHIR `action.participant` (role + optional specialty) — the required
    # performer for a materializing block, resolved to a Practitioner at
    # enrollment. `None` for non-materializing blocks (start/end/decision…).
    participant: ParticipantSpec | None = None

    # --- CLASS: per-kind metadata, no instance state, no DB columns ---
    KIND: ClassVar[str] = ""
    LABEL: ClassVar[str] = ""
    DESCRIPTION: ClassVar[str] = ""
    ICON: ClassVar[str] = ""
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = ()
    EVENTS: ClassVar[tuple[str, ...]] = ()
    RESULT_TYPE: ClassVar[type | None] = None
    FIELD_MODES: ClassVar[dict[str, FieldMode]] = {}
    DEFERRED_FIELDS: ClassVar[tuple[DeferredFieldSpec, ...]] = ()

    # Provenance metadata mirrored from the retired `BlockTypeEntry` so the
    # API + builder palette keep their existing grouping behaviour during
    # the chain-slot-#1 transition.
    SOURCE: ClassVar[BlockSourceLiteral] = "native"
    PROVIDER: ClassVar[str | None] = None
    SUBKIND: ClassVar[str | None] = None

    # Whether the block supports authored output branches (e.g. DecisionBlock).
    SUPPORTS_BRANCHES: ClassVar[bool] = False

    # Wire-facing `pathway_block.type` identifier exposed via the block
    # catalogue and surfaced on the legacy slot-#1 compat envelope.
    # Defaults to `KIND` for native blocks; external-provider blocks
    # override it to keep their dotted legacy code (e.g. `luscii.program`)
    # while their `KIND` is the typed-union discriminator (`external_program`).
    TYPE_CODE: ClassVar[str] = ""

    # JSON Schema for the legacy `config` bag, surfaced via
    # `GET /pathways/blocks` so the builder inspector can drive
    # schema-form rendering + autosave validation. Slot #1 dual-write
    # keeps this in lockstep with the typed instance fields; slot #2
    # retires `config` entirely and the builder reads off
    # `model_json_schema()` on the subclass directly.
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = {}

    # Widget hints + field order consumed by the orchestrator's
    # SchemaForm engine. Free-form mirror of the legacy
    # `BlockTypeEntry.ui_schema` field.
    UI_SCHEMA: ClassVar[dict[str, Any]] = {}

    # UI hint for blocks whose body renders nested content (today only
    # `PathwayLinkBlock`). `None` for blocks without nested content.
    NESTED_RENDER: ClassVar[NestedRenderLiteral | None] = None

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if not cls.__name__.startswith("_") and cls.KIND == "":
            raise TypeError(
                f"{cls.__name__} must set a non-empty `KIND` class attribute "
                "for SQLAlchemy polymorphic identity"
            )


class UnknownBlockKindError(LookupError):
    """Raised when a `kind` discriminator has no matching `BaseBlock` subclass.

    Surfaces from the resolver that maps a legacy `type: str` (or a freshly
    deserialised `kind` field) to the right subclass. The error name is
    referenced by the spec scenario "Unknown kind rejected at construction"
    in `pathway-model-foundations/spec.md`.
    """


__all__ = [
    "BaseBlock",
    "FieldMode",
    "UnknownBlockKindError",
]
