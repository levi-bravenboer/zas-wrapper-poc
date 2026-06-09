"""TaskBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER, LANE_KIND_PATIENT


TaskAssignee = Literal["patient", "caregiver"]


class TaskBlock(BaseBlock):
    KIND: ClassVar[str] = "task"
    TYPE_CODE: ClassVar[str] = "task"
    LABEL: ClassVar[str] = "Taak"
    DESCRIPTION: ClassVar[str] = "A work item assigned to the patient or a caregiver."
    ICON: ClassVar[str] = "list-checks"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_PATIENT, LANE_KIND_CAREGIVER)
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "title": {"type": "string", "minLength": 1, "maxLength": 255},
            "assignee": {"type": "string", "enum": ["patient", "caregiver"]},
            "due_offset_days": {"type": "integer", "minimum": 0},
            "requires_completion": {"type": "boolean"},
            "notes": {"type": "string", "maxLength": 2000},
        },
        required=["title", "assignee"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": [
            "title",
            "assignee",
            "due_offset_days",
            "requires_completion",
            "notes",
        ],
    }

    title: str
    assignee: TaskAssignee
    due_offset_days: int | None = None
    requires_completion: bool | None = None
    notes: str | None = None


__all__ = ["TaskAssignee", "TaskBlock"]
