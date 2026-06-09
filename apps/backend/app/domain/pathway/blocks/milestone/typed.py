"""MilestoneBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import Any, ClassVar

from pydantic import Field

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


class MilestoneBlock(BaseBlock):
    KIND: ClassVar[str] = "milestone"
    TYPE_CODE: ClassVar[str] = "milestone"
    LABEL: ClassVar[str] = "Mijlpaal"
    DESCRIPTION: ClassVar[str] = "A marker indicating a significant point in the pathway."
    ICON: ClassVar[str] = "flag"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "label": {"type": "string", "minLength": 1, "maxLength": 255},
            "description": {"type": "string", "maxLength": 2000},
            "icon": {"type": "string", "maxLength": 64},
        },
        required=["label"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["label", "description", "icon"],
    }

    label: str = Field(min_length=1, max_length=255)
    description: str | None = None
    icon: str | None = None


__all__ = ["MilestoneBlock"]
