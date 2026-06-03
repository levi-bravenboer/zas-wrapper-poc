from __future__ import annotations

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import BlockSemantics, BlockTypeEntry
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


BLOCK = BlockTypeEntry(
    type="decision",
    label="Beslissing",
    semantics=BlockSemantics.DECISION,
    icon="git-branch",
    allowed_lane_kind_codes=(LANE_KIND_SYSTEM,),
    supports_branches=True,
    config_schema=object_schema(
        properties={
            "question": {"type": "string", "minLength": 1, "maxLength": 500},
            "auto_resolve": {
                "type": "object",
                "additionalProperties": False,
                "required": ["source_block_id", "field_path"],
                "properties": {
                    "source_block_id": {"type": "string", "format": "uuid"},
                    "field_path": {"type": "string", "minLength": 1, "maxLength": 255},
                },
            },
        },
        required=["question"],
    ),
    ui_schema={
        "order": ["question", "auto_resolve"],
    },
)


__all__ = ["BLOCK"]
