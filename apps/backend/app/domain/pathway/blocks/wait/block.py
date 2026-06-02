from __future__ import annotations

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import BlockSemantics, BlockTypeEntry
from app.domain.pathway.events import get_event_type_codes
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


BLOCK = BlockTypeEntry(
    type="wait",
    label="Wachten op resultaat",
    semantics=BlockSemantics.WAIT,
    icon="hourglass",
    allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
    config_schema=object_schema(
        properties={
            "event_type": {"type": "string", "enum": list(get_event_type_codes())},
            "source_block_id": {"type": "string", "format": "uuid"},
            "timeout_days": {"type": "integer", "minimum": 0},
            "on_timeout": {"type": "string", "enum": ["continue", "escalate"]},
        },
        required=["event_type"],
    ),
    ui_schema={
        "order": ["event_type", "source_block_id", "timeout_days", "on_timeout"],
        "widgets": {"event_type": "event-type-picker"},
    },
)


__all__ = ["BLOCK"]
