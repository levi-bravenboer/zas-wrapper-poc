"""TaskBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import ClassVar, Literal

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER, LANE_KIND_PATIENT


TaskAssignee = Literal["patient", "caregiver"]


class TaskBlock(BaseBlock):
    KIND: ClassVar[str] = "task"
    LABEL: ClassVar[str] = "Taak"
    DESCRIPTION: ClassVar[str] = "A work item assigned to the patient or a caregiver."
    ICON: ClassVar[str] = "list-checks"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_PATIENT, LANE_KIND_CAREGIVER)

    title: str
    assignee: TaskAssignee
    due_offset_days: int | None = None
    requires_completion: bool | None = None
    notes: str | None = None


__all__ = ["TaskAssignee", "TaskBlock"]
