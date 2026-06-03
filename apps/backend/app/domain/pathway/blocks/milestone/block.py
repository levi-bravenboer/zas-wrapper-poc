from __future__ import annotations

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import BlockSemantics, BlockTypeEntry
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


BLOCK = BlockTypeEntry(
    type="milestone",
    label="Mijlpaal",
    semantics=BlockSemantics.MILESTONE,
    icon="flag",
    allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
    config_schema=object_schema(
        properties={
            "label": {"type": "string", "minLength": 1, "maxLength": 255},
            "description": {"type": "string", "maxLength": 2000},
            "icon": {"type": "string", "maxLength": 64},
        },
        required=["label"],
    ),
    ui_schema={
        "order": ["label", "description", "icon"],
    },
)


__all__ = ["BLOCK"]
