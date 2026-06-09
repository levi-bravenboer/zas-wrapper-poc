"""WaitBlock — typed `BaseBlock` subclass."""

from __future__ import annotations

from typing import Any, ClassVar, Literal
from uuid import UUID

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.events import get_event_type_codes
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


WaitOnTimeout = Literal["continue", "escalate"]


class WaitBlock(BaseBlock):
    KIND: ClassVar[str] = "wait"
    TYPE_CODE: ClassVar[str] = "wait"
    LABEL: ClassVar[str] = "Wachten op resultaat"
    DESCRIPTION: ClassVar[str] = "Pauses execution until a typed event arrives from a referenced block."
    ICON: ClassVar[str] = "hourglass"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "event_type": {"type": "string", "enum": list(get_event_type_codes())},
            "source_block_id": {"type": "string", "format": "uuid"},
            "timeout_days": {"type": "integer", "minimum": 0},
            "on_timeout": {"type": "string", "enum": ["continue", "escalate"]},
        },
        required=["event_type"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["event_type", "source_block_id", "timeout_days", "on_timeout"],
        "widgets": {"event_type": "event-type-picker"},
    }

    event_type: str
    source_block_id: UUID | None = None
    timeout_days: int | None = None
    on_timeout: WaitOnTimeout | None = None

    @classmethod
    def supported_event_types(cls) -> tuple[str, ...]:
        return tuple(get_event_type_codes())


__all__ = ["WaitBlock", "WaitOnTimeout"]
