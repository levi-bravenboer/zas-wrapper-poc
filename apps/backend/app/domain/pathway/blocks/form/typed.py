"""FormBlock — typed `BaseBlock` subclass with nested question models."""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from pydantic import BaseModel, Field

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
    LABEL: ClassVar[str] = "Formulier"
    DESCRIPTION: ClassVar[str] = "A questionnaire the patient fills in."
    ICON: ClassVar[str] = "clipboard-list"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_PATIENT,)

    title: str = Field(min_length=1, max_length=255)
    intro: str | None = None
    questions: list[FormQuestion] = Field(min_length=1)
    submit_label: str | None = None
    confirmation_message: str | None = None


__all__ = ["FormBlock", "FormQuestion", "FormQuestionOption", "FormQuestionType"]
