# Server-side static registries (D2 + D14). Block-type and phase-template
# catalogues live in code, not the DB. Both are queryable through dedicated
# GET endpoints so the orchestrator never hardcodes block names, config
# shapes, or chapter labels. Adding/removing entries here is a backend deploy.

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


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


@dataclass(frozen=True, slots=True)
class BlockTypeEntry:
    type: str
    label: str
    default_lane_kind_code: str
    config_schema: dict[str, Any]
    supports_branches: bool = False


@dataclass(frozen=True, slots=True)
class PhaseTemplateEntry:
    id: str
    label: str
    default_ord: int
    default_duration_days: int | None = None


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


BLOCK_TYPES: tuple[BlockTypeEntry, ...] = (
    BlockTypeEntry(
        type="appointment",
        label="Appointment",
        default_lane_kind_code=LANE_KIND_CAREGIVER,
        config_schema=_object_schema(
            properties={
                "title": {"type": "string", "minLength": 1, "maxLength": 255},
                "location": {"type": "string", "maxLength": 255},
                "duration_minutes": {"type": "integer", "minimum": 0},
                "notes": {"type": "string", "maxLength": 2000},
            },
            required=["title"],
        ),
    ),
    BlockTypeEntry(
        type="decision",
        label="Decision",
        default_lane_kind_code=LANE_KIND_CAREGIVER,
        supports_branches=True,
        config_schema=_object_schema(
            properties={
                "question": {"type": "string", "minLength": 1, "maxLength": 500},
            },
            required=["question"],
        ),
    ),
    BlockTypeEntry(
        type="milestone",
        label="Milestone",
        default_lane_kind_code=LANE_KIND_SYSTEM,
        config_schema=_object_schema(
            properties={
                "label": {"type": "string", "minLength": 1, "maxLength": 255},
            },
            required=["label"],
        ),
    ),
    BlockTypeEntry(
        type="timer",
        label="Timer",
        default_lane_kind_code=LANE_KIND_SYSTEM,
        config_schema=_object_schema(
            properties={
                "note": {"type": "string", "maxLength": 500},
            },
        ),
    ),
    BlockTypeEntry(
        type="task",
        label="Task",
        default_lane_kind_code=LANE_KIND_CAREGIVER,
        config_schema=_object_schema(
            properties={
                "title": {"type": "string", "minLength": 1, "maxLength": 255},
                "notes": {"type": "string", "maxLength": 2000},
            },
            required=["title"],
        ),
    ),
    BlockTypeEntry(
        type="email",
        label="Email",
        default_lane_kind_code=LANE_KIND_PATIENT,
        config_schema=_object_schema(
            properties={
                "subject": {"type": "string", "minLength": 1, "maxLength": 255},
                "body": {"type": "string", "maxLength": 5000},
            },
            required=["subject"],
        ),
    ),
)

_BLOCK_TYPES_BY_NAME: dict[str, BlockTypeEntry] = {entry.type: entry for entry in BLOCK_TYPES}


def get_block_type(type_name: str) -> BlockTypeEntry | None:
    return _BLOCK_TYPES_BY_NAME.get(type_name)


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
    "BlockTypeEntry",
    "LANE_KIND_CAREGIVER",
    "LANE_KIND_EXTERNAL",
    "LANE_KIND_PATIENT",
    "LANE_KIND_SYSTEM",
    "PHASE_TEMPLATES",
    "PhaseTemplateEntry",
    "SEEDED_LANE_KINDS",
    "get_block_type",
    "get_phase_template",
]
