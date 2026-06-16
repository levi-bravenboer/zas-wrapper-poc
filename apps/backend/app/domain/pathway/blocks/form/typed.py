"""FormBlock — typed `BaseBlock` subclass with nested question models."""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from pydantic import BaseModel, Field

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_PATIENT


FormQuestionType = Literal[
    "text",
    "long_text",
    "single_choice",
    "multi_choice",
    "scale",
    "date",
    "file",
]


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


class FormQuestionOption(BaseModel):
    value: str = Field(min_length=1, max_length=128)
    label: str = Field(min_length=1, max_length=255)


class FormQuestion(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    type: FormQuestionType
    label: str = Field(min_length=1, max_length=500)
    required: bool
    options: list[FormQuestionOption] = []
    validation: dict[str, Any] | None = None


class FormBlock(BaseBlock):
    KIND: ClassVar[str] = "form"
    TYPE_CODE: ClassVar[str] = "form"
    LABEL: ClassVar[str] = "Formulier"
    DESCRIPTION: ClassVar[str] = "A questionnaire the patient fills in."
    ICON: ClassVar[str] = "clipboard-list"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_PATIENT,)
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
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
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": [
            "title",
            "intro",
            "questions",
            "submit_label",
            "confirmation_message",
        ],
        "widgets": {"questions": "form-questions"},
    }

    title: str = Field(min_length=1, max_length=255)
    intro: str | None = None
    questions: list[FormQuestion] = Field(min_length=1)
    submit_label: str | None = None
    confirmation_message: str | None = None


__all__ = ["FormBlock", "FormQuestion", "FormQuestionOption", "FormQuestionType"]
