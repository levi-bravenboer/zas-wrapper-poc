from __future__ import annotations

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import BlockSemantics, BlockTypeEntry
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER


BLOCK = BlockTypeEntry(
    type="appointment",
    label="Afspraak",
    semantics=BlockSemantics.APPOINTMENT,
    icon="calendar",
    allowed_lane_kind_codes=(LANE_KIND_CAREGIVER,),
    config_schema=object_schema(
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
)


__all__ = ["BLOCK"]
