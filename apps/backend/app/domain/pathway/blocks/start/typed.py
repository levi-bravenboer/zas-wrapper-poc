"""StartBlock — typed `BaseBlock` subclass (catalogue-expansion § 1)."""

from __future__ import annotations

from typing import Any, ClassVar

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


class StartBlock(BaseBlock):
    """Pathway entry block.

    Cardinality: exactly one per pathway version (enforced at publish
    time). The block has no per-kind config — `BaseBlock.name` is the
    only authored field. Empty `input_logic` and `timing_policy=None`
    are also enforced at publish time: a start cannot wait on anything
    and has no timing of its own.

    Runtime semantic: at enrollment create, every `StartBlock`
    execution is materialised directly in `state=completed`. Downstream
    blocks whose `input_logic.rules` reference the start with the
    `if_done` predicate become eligible on the same eligibility pass
    that runs at enrollment create. The caregiver triggers the start
    implicitly by enrolling the patient — there is no explicit "start"
    HTTP call against the runtime aggregate.
    """

    KIND: ClassVar[str] = "start"
    TYPE_CODE: ClassVar[str] = "start"
    LABEL: ClassVar[str] = "Start"
    DESCRIPTION: ClassVar[str] = (
        "Entry block. Fires automatically on enrollment; downstream "
        "blocks gated by `if_done(start)` become eligible immediately."
    )
    ICON: ClassVar[str] = "play"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_SYSTEM,)
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "name": {"type": "string", "minLength": 1, "maxLength": 255},
        },
        required=["name"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["name"],
    }


__all__ = ["StartBlock"]
