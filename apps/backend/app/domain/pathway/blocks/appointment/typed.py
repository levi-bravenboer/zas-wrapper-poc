"""AppointmentBlock — typed `BaseBlock` subclass.

Replaces the data-driven `BlockTypeEntry` shape in `block.py` for the
`appointment` kind. See `openspec/changes/pathway-model-foundations/`.
"""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock, FieldMode
from app.domain.pathway.blocks.deferred import DeferredFieldSpec
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER


AppointmentMode = Literal["in_person", "video", "phone"]


class AppointmentBlock(BaseBlock):
    KIND: ClassVar[str] = "appointment"
    ACTOR: ClassVar[str] = "caregiver"
    COMPLETION: ClassVar[str] = "caregiver_action"
    TYPE_CODE: ClassVar[str] = "appointment"
    LABEL: ClassVar[str] = "Afspraak"
    DESCRIPTION: ClassVar[str] = "A scheduled meeting with a caregiver or patient."
    ICON: ClassVar[str] = "calendar"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_CAREGIVER,)
    EVENTS: ClassVar[tuple[str, ...]] = ("rescheduled", "patient_no_show")
    FIELD_MODES: ClassVar[dict[str, FieldMode]] = {
        "mode": "always_static",
        "location": "builder_choice",
        "duration_minutes": "builder_choice",
        "scheduled_at": "always_deferred",
    }
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "title": {"type": "string", "minLength": 1, "maxLength": 255},
            "mode": {"type": "string", "enum": ["in_person", "video", "phone"]},
            "location": {"type": "string", "maxLength": 255},
            "duration_minutes": {"type": "integer", "minimum": 0},
            "attendees_patient": {"type": "boolean"},
            "notes": {"type": "string", "maxLength": 2000},
        },
        required=["title"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": [
            "title",
            "mode",
            "location",
            "duration_minutes",
            "attendees_patient",
            "notes",
        ],
    }
    DEFERRED_FIELDS: ClassVar[tuple[DeferredFieldSpec, ...]] = (
        DeferredFieldSpec(
            attr="location",
            label="Locatie afspraak",
            kind="text",
            required=False,
        ),
        # `scheduled_at` lands on `BlockExecution` in chain slot #3
        # (`pathway-runtime-aggregate`) per D5 — not a template field, so
        # the deferred spec is reintroduced there with the runtime column.
    )

    title: str
    mode: AppointmentMode | None = None
    location: str | None = None
    duration_minutes: int | None = None
    attendees_patient: bool | None = None
    notes: str | None = None


__all__ = ["AppointmentBlock", "AppointmentMode"]
