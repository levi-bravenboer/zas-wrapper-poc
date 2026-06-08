"""WaitBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import ClassVar, Literal
from uuid import UUID

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.events import get_event_type_codes
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


WaitOnTimeout = Literal["continue", "escalate"]


class WaitBlock(BaseBlock):
    KIND: ClassVar[str] = "wait"
    LABEL: ClassVar[str] = "Wachten op resultaat"
    DESCRIPTION: ClassVar[str] = "Pauses execution until a typed event arrives from a referenced block."
    ICON: ClassVar[str] = "hourglass"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)

    event_type: str
    source_block_id: UUID | None = None
    timeout_days: int | None = None
    on_timeout: WaitOnTimeout | None = None

    @classmethod
    def supported_event_types(cls) -> tuple[str, ...]:
        return tuple(get_event_type_codes())


__all__ = ["WaitBlock", "WaitOnTimeout"]
