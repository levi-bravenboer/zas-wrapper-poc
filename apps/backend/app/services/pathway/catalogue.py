# Server-side static registries (D2 + D14). Block-type and phase-template
# catalogues live in code, not the DB. Both are queryable through dedicated
# GET endpoints so the orchestrator never hardcodes block names, config
# shapes, or chapter labels. Adding/removing entries here is a backend deploy.

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any

from app.schemas.pathway.catalogue import BlockSourceLiteral as BlockSource

# Shared link-mode enum reused across every block whose runtime semantics
# include "do I wait for the linked execution to finish, or fire and continue?"
# Today: `pathway_link` + `luscii.program`. Future link-shaped blocks (HiX
# task delegation, registry follow-up) plug in here without a new constant.
BLOCKING_MODES: tuple[str, ...] = ("blocking", "fire_and_forget")


LANE_KIND_PATIENT = "patient"
LANE_KIND_CAREGIVER = "caregiver"
LANE_KIND_SYSTEM = "system"
LANE_KIND_EXTERNAL = "external"

SEEDED_LANE_KINDS: tuple[tuple[str, str], ...] = (
    (LANE_KIND_PATIENT, "Patient"),
    (LANE_KIND_CAREGIVER, "Caregiver"),
    (LANE_KIND_SYSTEM, "System"),
    (LANE_KIND_EXTERNAL, "External"),
)

# (code, label, ord). Mirrors SEEDED_LANE_KINDS: code-owned source of truth;
# the DB table `pathway_edge_offset_direction` is seeded from this and exists
# only so FK integrity can be enforced on `pathway_edge.offset_direction_code`.
SEEDED_OFFSET_DIRECTIONS: tuple[tuple[str, str, int], ...] = (
    ("before", "Voor", 10),
    ("after", "Na", 20),
)


class BlockSemantics(str, enum.Enum):
    APPOINTMENT = "appointment"
    TASK = "task"
    MESSAGE = "message"
    FORM = "form"
    DECISION = "decision"
    MILESTONE = "milestone"
    WAIT = "wait"
    PATHWAY_LINK = "pathway_link"
    # External-provider blocks whose body is a reference to a vendor program
    # (e.g. a Luscii care path). Dispatch key shared across vendors so the
    # builder inspector picks the provider-specific React component from an
    # inner `{provider: Component}` map — no per-vendor switch in
    # `BuilderDrawer`. See `openspec/changes/external-block-integrations/design.md`.
    EXTERNAL_PROGRAM = "external_program"


@dataclass(frozen=True, slots=True)
class EventTypeEntry:
    code: str
    label: str


# Closed enum of external events the `wait` block may listen for. Promotion to
# a tenant-extensible lookup table is deferred (see design D3).
EVENT_TYPES: tuple[EventTypeEntry, ...] = (
    EventTypeEntry(code="pathology_report", label="Pathologie verslag"),
    EventTypeEntry(code="scan_report", label="Radiologie verslag"),
    EventTypeEntry(code="lab_result", label="Lab uitslag"),
    EventTypeEntry(code="external_data", label="Externe data"),
)

_EVENT_TYPE_CODES: tuple[str, ...] = tuple(e.code for e in EVENT_TYPES)


@dataclass(frozen=True, slots=True)
class BlockTypeEntry:
    type: str
    label: str
    semantics: BlockSemantics
    icon: str
    # First entry is the default placement when no explicit lane context exists.
    allowed_lane_kind_codes: tuple[str, ...]
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any] = field(default_factory=dict)
    supports_branches: bool = False
    # Provenance — drives frontend palette grouping + per-provider thumbnail
    # / inspector dispatch. Native blocks default to source='native' with no
    # provider/kind. External blocks contributed via dotted codes (e.g.
    # `luscii.program`) declare source='external' + the provider/kind pair
    # parsed from the dotted code.
    source: BlockSource = "native"
    provider: str | None = None
    kind: str | None = None


@dataclass(frozen=True, slots=True)
class PhaseTemplateEntry:
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None


@dataclass(frozen=True, slots=True)
class EdgeTimingKindEntry:
    kind: str
    label: str
    config_schema: dict[str, Any]
    ui_schema: dict[str, Any]


def _object_schema(
    properties: dict[str, dict[str, Any]],
    required: list[str] | None = None,
) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
    }
    if required:
        schema["required"] = required
    return schema


_FORM_QUESTION_TYPES: tuple[str, ...] = (
    "text",
    "long_text",
    "single_choice",
    "multi_choice",
    "scale",
    "date",
    "file",
)

_FORM_QUESTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "type", "label", "required"],
    "properties": {
        "id": {"type": "string", "minLength": 1, "maxLength": 64},
        "type": {"type": "string", "enum": list(_FORM_QUESTION_TYPES)},
        "label": {"type": "string", "minLength": 1, "maxLength": 500},
        "required": {"type": "boolean"},
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["value", "label"],
                "properties": {
                    "value": {"type": "string", "minLength": 1, "maxLength": 128},
                    "label": {"type": "string", "minLength": 1, "maxLength": 255},
                },
            },
        },
        "validation": {
            "type": "object",
            "additionalProperties": True,
        },
    },
}


BLOCK_TYPES: tuple[BlockTypeEntry, ...] = (
    BlockTypeEntry(
        type="appointment",
        label="Afspraak",
        semantics=BlockSemantics.APPOINTMENT,
        icon="calendar",
        allowed_lane_kind_codes=(LANE_KIND_CAREGIVER,),
        config_schema=_object_schema(
            properties={
                "title": {"type": "string", "minLength": 1, "maxLength": 255},
                "mode": {"type": "string", "enum": ["in_person", "video", "phone"]},
                "location": {"type": "string", "maxLength": 255},
                "duration_minutes": {"type": "integer", "minimum": 0},
                "attendees_patient": {"type": "boolean"},
                "notes": {"type": "string", "maxLength": 2000},
            },
            required=["title"],
        ),
        ui_schema={
            "order": [
                "title",
                "mode",
                "location",
                "duration_minutes",
                "attendees_patient",
                "notes",
            ],
        },
    ),
    BlockTypeEntry(
        type="task",
        label="Taak",
        semantics=BlockSemantics.TASK,
        icon="list-checks",
        allowed_lane_kind_codes=(LANE_KIND_PATIENT, LANE_KIND_CAREGIVER),
        config_schema=_object_schema(
            properties={
                "title": {"type": "string", "minLength": 1, "maxLength": 255},
                "assignee": {"type": "string", "enum": ["patient", "caregiver"]},
                "due_offset_days": {"type": "integer", "minimum": 0},
                "requires_completion": {"type": "boolean"},
                "notes": {"type": "string", "maxLength": 2000},
            },
            required=["title", "assignee"],
        ),
        ui_schema={
            "order": [
                "title",
                "assignee",
                "due_offset_days",
                "requires_completion",
                "notes",
            ],
        },
    ),
    BlockTypeEntry(
        type="message",
        label="Bericht",
        semantics=BlockSemantics.MESSAGE,
        icon="mail",
        allowed_lane_kind_codes=(LANE_KIND_PATIENT,),
        config_schema=_object_schema(
            properties={
                "channel": {
                    "type": "string",
                    "enum": ["email", "sms", "push", "in_app"],
                },
                "subject": {"type": "string", "minLength": 1, "maxLength": 255},
                "body": {"type": "string", "maxLength": 5000},
                "cta_label": {"type": "string", "maxLength": 64},
                "cta_target": {"type": "string", "maxLength": 1024},
            },
            required=["channel", "subject", "body"],
        ),
        ui_schema={
            "order": ["channel", "subject", "body", "cta_label", "cta_target"],
            "widgets": {"channel": "channel-picker"},
        },
    ),
    BlockTypeEntry(
        type="form",
        label="Formulier",
        semantics=BlockSemantics.FORM,
        icon="clipboard-list",
        allowed_lane_kind_codes=(LANE_KIND_PATIENT,),
        config_schema=_object_schema(
            properties={
                "title": {"type": "string", "minLength": 1, "maxLength": 255},
                "intro": {"type": "string", "maxLength": 2000},
                "questions": {
                    "type": "array",
                    "minItems": 1,
                    "items": _FORM_QUESTION_SCHEMA,
                },
                "submit_label": {"type": "string", "maxLength": 64},
                "confirmation_message": {"type": "string", "maxLength": 2000},
            },
            required=["title", "questions"],
        ),
        ui_schema={
            "order": [
                "title",
                "intro",
                "questions",
                "submit_label",
                "confirmation_message",
            ],
            "widgets": {"questions": "form-questions"},
        },
    ),
    BlockTypeEntry(
        type="decision",
        label="Beslissing",
        semantics=BlockSemantics.DECISION,
        icon="git-branch",
        allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
        supports_branches=True,
        config_schema=_object_schema(
            properties={
                "question": {"type": "string", "minLength": 1, "maxLength": 500},
                "auto_resolve": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["source_block_id", "field_path"],
                    "properties": {
                        "source_block_id": {"type": "string", "format": "uuid"},
                        "field_path": {"type": "string", "minLength": 1, "maxLength": 255},
                    },
                },
            },
            required=["question"],
        ),
        ui_schema={
            "order": ["question", "auto_resolve"],
        },
    ),
    BlockTypeEntry(
        type="milestone",
        label="Mijlpaal",
        semantics=BlockSemantics.MILESTONE,
        icon="flag",
        allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
        config_schema=_object_schema(
            properties={
                "label": {"type": "string", "minLength": 1, "maxLength": 255},
                "description": {"type": "string", "maxLength": 2000},
                "icon": {"type": "string", "maxLength": 64},
            },
            required=["label"],
        ),
        ui_schema={
            "order": ["label", "description", "icon"],
        },
    ),
    BlockTypeEntry(
        type="wait",
        label="Wachten op resultaat",
        semantics=BlockSemantics.WAIT,
        icon="hourglass",
        allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
        config_schema=_object_schema(
            properties={
                "event_type": {"type": "string", "enum": list(_EVENT_TYPE_CODES)},
                "source_block_id": {"type": "string", "format": "uuid"},
                "timeout_days": {"type": "integer", "minimum": 0},
                "on_timeout": {"type": "string", "enum": ["continue", "escalate"]},
            },
            required=["event_type"],
        ),
        ui_schema={
            "order": ["event_type", "source_block_id", "timeout_days", "on_timeout"],
            "widgets": {"event_type": "event-type-picker"},
        },
    ),
    BlockTypeEntry(
        type="pathway_link",
        label="Pad-koppeling",
        semantics=BlockSemantics.PATHWAY_LINK,
        icon="link-2",
        allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
        config_schema=_object_schema(
            properties={
                "target_pathway_id": {"type": "string", "format": "uuid"},
                "mode": {"type": "string", "enum": list(BLOCKING_MODES)},
                "context_mapping": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                },
            },
            required=["target_pathway_id", "mode"],
        ),
        ui_schema={
            "order": ["target_pathway_id", "mode", "context_mapping"],
            "widgets": {"target_pathway_id": "pathway-picker"},
        },
    ),
    # External-provider block: Luscii Program. The block stores a reference
    # to a Luscii care path (`program_id` + `protocol_id`) plus the wait
    # mode; everything else (instruments, thresholds, schedule, education)
    # is authored inside Luscii Builder and is read-only here. Per-patient
    # values (BSN, contact, locale) are filled at runtime by the caregiver,
    # not at design-time — see design.md "Per-patient values stay at
    # enrollment runtime".
    BlockTypeEntry(
        type="luscii.program",
        label="Luscii Program",
        semantics=BlockSemantics.EXTERNAL_PROGRAM,
        icon="activity",
        allowed_lane_kind_codes=(LANE_KIND_EXTERNAL,),
        source="external",
        provider="luscii",
        kind="program",
        config_schema=_object_schema(
            properties={
                "program_id": {"type": "string", "minLength": 1, "maxLength": 128},
                "protocol_id": {"type": "string", "minLength": 1, "maxLength": 128},
                "mode": {"type": "string", "enum": list(BLOCKING_MODES)},
            },
            required=["program_id", "protocol_id", "mode"],
        ),
        ui_schema={
            "order": ["program_id", "protocol_id", "mode"],
            "widgets": {
                "program_id": "luscii-program-picker",
                "protocol_id": "luscii-protocol-picker",
            },
        },
    ),
)

_BLOCK_TYPES_BY_NAME: dict[str, BlockTypeEntry] = {entry.type: entry for entry in BLOCK_TYPES}


def get_block_type(type_name: str) -> BlockTypeEntry | None:
    return _BLOCK_TYPES_BY_NAME.get(type_name)


def get_event_type_codes() -> tuple[str, ...]:
    return _EVENT_TYPE_CODES


# Edge timing kinds expose per-kind JSON Schemas. The schema validates the
# subset of edge columns that the kind expects to see set; the service layer
# still enforces the cross-kind invariant (`num_nonnulls(...) <= 1`).
EDGE_TIMING_KINDS: tuple[EdgeTimingKindEntry, ...] = (
    EdgeTimingKindEntry(
        kind="completion",
        label="Na voltooiing",
        config_schema=_object_schema(
            properties={
                "delay_value_id": {"type": "string", "format": "uuid"},
            },
            required=["delay_value_id"],
        ),
        ui_schema={"order": ["delay_value_id"]},
    ),
    EdgeTimingKindEntry(
        kind="marker",
        label="Rond marker",
        config_schema=_object_schema(
            properties={
                "time_marker_id": {"type": "string", "format": "uuid"},
                "offset_value_id": {"type": "string", "format": "uuid"},
                "offset_direction_code": {"type": "string", "enum": ["before", "after"]},
            },
            required=["time_marker_id", "offset_value_id", "offset_direction_code"],
        ),
        ui_schema={
            "order": ["time_marker_id", "offset_direction_code", "offset_value_id"],
            "widgets": {"offset_direction_code": "offset-direction-picker"},
        },
    ),
    EdgeTimingKindEntry(
        kind="immediate",
        label="Direct",
        config_schema=_object_schema(properties={}),
        ui_schema={"order": []},
    ),
    EdgeTimingKindEntry(
        kind="branch",
        label="Vanaf tak",
        config_schema=_object_schema(
            properties={
                "source_branch_id": {"type": "string", "format": "uuid"},
            },
            required=["source_branch_id"],
        ),
        ui_schema={"order": ["source_branch_id"]},
    ),
)


PHASE_TEMPLATES: tuple[PhaseTemplateEntry, ...] = (
    PhaseTemplateEntry(id="pre-op", label="Pre-op", default_ord=10, default_duration_days=14),
    PhaseTemplateEntry(id="surgery", label="Surgery", default_ord=20, default_duration_days=1),
    PhaseTemplateEntry(id="recovery", label="Recovery", default_ord=30, default_duration_days=30),
    PhaseTemplateEntry(id="follow-up", label="Follow-up", default_ord=40, default_duration_days=90),
)

_PHASE_TEMPLATES_BY_ID: dict[str, PhaseTemplateEntry] = {p.id: p for p in PHASE_TEMPLATES}


def get_phase_template(template_id: str) -> PhaseTemplateEntry | None:
    return _PHASE_TEMPLATES_BY_ID.get(template_id)


__all__ = [
    "BLOCK_TYPES",
    "BlockSemantics",
    "BlockTypeEntry",
    "EDGE_TIMING_KINDS",
    "EVENT_TYPES",
    "EdgeTimingKindEntry",
    "EventTypeEntry",
    "LANE_KIND_CAREGIVER",
    "LANE_KIND_EXTERNAL",
    "LANE_KIND_PATIENT",
    "LANE_KIND_SYSTEM",
    "PHASE_TEMPLATES",
    "PhaseTemplateEntry",
    "SEEDED_LANE_KINDS",
    "SEEDED_OFFSET_DIRECTIONS",
    "get_block_type",
    "get_event_type_codes",
    "get_phase_template",
]
