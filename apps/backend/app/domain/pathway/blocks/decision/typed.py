"""DecisionBlock — typed `BaseBlock` subclass.

Carries `SUPPORTS_BRANCHES = True` because publish-time validation in
chain slot #2 (`pathway-input-logic-and-timing`) treats this block as the
sole producer-of-typed-outputs in the current catalogue. The `outputs`
tuple field is added in chain slot #2; here we only carry the authoring
fields the builder needs today.
"""

from __future__ import annotations

from typing import Any, ClassVar
from uuid import UUID

from pydantic import BaseModel

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


class DecisionAutoResolve(BaseModel):
    source_block_id: UUID
    field_path: str


class DecisionBlock(BaseBlock):
    KIND: ClassVar[str] = "decision"
    TYPE_CODE: ClassVar[str] = "decision"
    LABEL: ClassVar[str] = "Beslissing"
    DESCRIPTION: ClassVar[str] = "Routes execution to one or more downstream blocks based on a predicate."
    ICON: ClassVar[str] = "git-branch"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    SUPPORTS_BRANCHES: ClassVar[bool] = True
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
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
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["question", "auto_resolve"],
    }

    question: str
    auto_resolve: DecisionAutoResolve | None = None


__all__ = ["DecisionAutoResolve", "DecisionBlock"]
