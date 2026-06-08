"""DecisionBlock — typed `BaseBlock` subclass.

Carries `SUPPORTS_BRANCHES = True` because publish-time validation in
chain slot #2 (`pathway-input-logic-and-timing`) treats this block as the
sole producer-of-typed-outputs in the current catalogue. The `outputs`
tuple field is added in chain slot #2; here we only carry the authoring
fields the builder needs today.
"""

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

from pydantic import BaseModel

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


class DecisionAutoResolve(BaseModel):
    source_block_id: UUID
    field_path: str


class DecisionBlock(BaseBlock):
    KIND: ClassVar[str] = "decision"
    LABEL: ClassVar[str] = "Beslissing"
    DESCRIPTION: ClassVar[str] = "Routes execution to one or more downstream blocks based on a predicate."
    ICON: ClassVar[str] = "git-branch"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    SUPPORTS_BRANCHES: ClassVar[bool] = True

    question: str
    auto_resolve: DecisionAutoResolve | None = None


__all__ = ["DecisionAutoResolve", "DecisionBlock"]
