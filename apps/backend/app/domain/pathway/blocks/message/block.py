from __future__ import annotations

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import BlockSemantics, BlockTypeEntry
from app.domain.pathway.lanes import LANE_KIND_PATIENT


BLOCK = BlockTypeEntry(
    type="message",
    label="Bericht",
    semantics=BlockSemantics.MESSAGE,
    icon="mail",
    allowed_lane_kind_codes=(LANE_KIND_PATIENT,),
    config_schema=object_schema(
        properties={
            "channel": {
                "type": "string",
                "enum": ["email", "sms", "push", "in_app"],
            },
            "subject": {"type": "string", "minLength": 1, "maxLength": 255},
            "body": {"type": "string", "maxLength": 5000},
            "cta_label": {"type": "string", "maxLength": 64},
            "cta_target": {"type": "string", "maxLength": 1024},
        },
        required=["channel", "subject", "body"],
    ),
    ui_schema={
        "order": ["channel", "subject", "body", "cta_label", "cta_target"],
        "widgets": {"channel": "channel-picker"},
    },
)


__all__ = ["BLOCK"]
