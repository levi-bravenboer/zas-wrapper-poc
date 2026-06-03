from __future__ import annotations

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import BlockSemantics, BlockTypeEntry
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER, LANE_KIND_PATIENT


BLOCK = BlockTypeEntry(
    type="task",
    label="Taak",
    semantics=BlockSemantics.TASK,
    icon="list-checks",
    allowed_lane_kind_codes=(LANE_KIND_PATIENT, LANE_KIND_CAREGIVER),
    config_schema=object_schema(
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
)


__all__ = ["BLOCK"]
