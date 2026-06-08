"""MilestoneBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import ClassVar

from pydantic import Field

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


class MilestoneBlock(BaseBlock):
    KIND: ClassVar[str] = "milestone"
    LABEL: ClassVar[str] = "Mijlpaal"
    DESCRIPTION: ClassVar[str] = "A marker indicating a significant point in the pathway."
    ICON: ClassVar[str] = "flag"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)

    label: str = Field(min_length=1, max_length=255)
    description: str | None = None
    icon: str | None = None


__all__ = ["MilestoneBlock"]
