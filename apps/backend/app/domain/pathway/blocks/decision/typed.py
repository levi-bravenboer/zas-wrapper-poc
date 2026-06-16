"""DecisionBlock — typed `BaseBlock` subclass.

Carries `SUPPORTS_BRANCHES = True` because publish-time validation in
chain slot #2 (`pathway-input-logic-and-timing`) treats this block as the
sole producer-of-typed-outputs in the current catalogue. The `outputs`
tuple field is added in chain slot #2; here we only carry the authoring
fields the builder needs today.
"""

from __future__ import annotations

from typing import Any, ClassVar, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


DecisionMode = Literal["xor", "and"]


class DecisionAutoResolve(BaseModel):
    source_block_id: UUID
    field_path: str


class DecisionBlock(BaseBlock):
    KIND: ClassVar[str] = "decision"
    TYPE_CODE: ClassVar[str] = "decision"
    LABEL: ClassVar[str] = "Beslissing"
    DESCRIPTION: ClassVar[str] = (
        "Routes execution to one or more downstream blocks based on a predicate."
    )
    ICON: ClassVar[str] = "git-branch"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    SUPPORTS_BRANCHES: ClassVar[bool] = True
    # Slot #2 §5 declares the producer-of-typed-outputs invariant on
    # the class so downstream blocks can reference these keys via the
    # `decision_output` predicate. Empty `outputs` is rejected by the
    # publish-time validator (`_validate_decision_outputs`).
    PRODUCES_OUTPUTS: ClassVar[bool] = True
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
            "outputs": {
                "type": "array",
                "items": {"type": "string", "minLength": 1, "maxLength": 64},
                "uniqueItems": True,
            },
            "mode": {"type": "string", "enum": ["xor", "and"]},
        },
        required=["question"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["question", "outputs", "mode", "auto_resolve"],
    }

    question: str
    auto_resolve: DecisionAutoResolve | None = None
    # Typed outputs the runtime engine surfaces as the `output_key` on
    # the `decision_output` predicate. Slot #5 fork-out rules consume
    # them; the publish-time validator rejects empty tuples and
    # downstream rules pointing at non-existent keys.
    outputs: tuple[str, ...] = Field(default_factory=tuple)
    # `xor` = exactly one output fires (slot #3 runtime invariant);
    # `and` = independent outputs may fire concurrently. Defaults to
    # `and` so existing decision blocks promoted into slot #2 keep
    # their multi-output semantics unless the builder narrows them.
    mode: DecisionMode = "and"


__all__ = ["DecisionAutoResolve", "DecisionBlock", "DecisionMode"]
