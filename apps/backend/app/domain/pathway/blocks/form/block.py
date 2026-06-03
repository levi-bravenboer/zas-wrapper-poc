from __future__ import annotations

from typing import Any

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks._base import BlockSemantics, BlockTypeEntry
from app.domain.pathway.lanes import LANE_KIND_PATIENT


_FORM_QUESTION_TYPES: tuple[str, ...] = (
    "text",
    "long_text",
    "single_choice",
    "multi_choice",
    "scale",
    "date",
    "file",
)

_FORM_QUESTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "type", "label", "required"],
    "properties": {
        "id": {"type": "string", "minLength": 1, "maxLength": 64},
        "type": {"type": "string", "enum": list(_FORM_QUESTION_TYPES)},
        "label": {"type": "string", "minLength": 1, "maxLength": 500},
        "required": {"type": "boolean"},
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["value", "label"],
                "properties": {
                    "value": {"type": "string", "minLength": 1, "maxLength": 128},
                    "label": {"type": "string", "minLength": 1, "maxLength": 255},
                },
            },
        },
        "validation": {
            "type": "object",
            "additionalProperties": True,
        },
    },
}


BLOCK = BlockTypeEntry(
    type="form",
    label="Formulier",
    semantics=BlockSemantics.FORM,
    icon="clipboard-list",
    allowed_lane_kind_codes=(LANE_KIND_PATIENT,),
    config_schema=object_schema(
        properties={
            "title": {"type": "string", "minLength": 1, "maxLength": 255},
            "intro": {"type": "string", "maxLength": 2000},
            "questions": {
                "type": "array",
                "minItems": 1,
                "items": _FORM_QUESTION_SCHEMA,
            },
            "submit_label": {"type": "string", "maxLength": 64},
            "confirmation_message": {"type": "string", "maxLength": 2000},
        },
        required=["title", "questions"],
    ),
    ui_schema={
        "order": [
            "title",
            "intro",
            "questions",
            "submit_label",
            "confirmation_message",
        ],
        "widgets": {"questions": "form-questions"},
    },
)


__all__ = ["BLOCK"]
