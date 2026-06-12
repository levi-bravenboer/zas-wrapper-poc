"""EndPathwayBlock — typed `BaseBlock` subclass (catalogue-expansion § 2)."""

from __future__ import annotations

from typing import Any, ClassVar

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_SYSTEM


class EndPathwayBlock(BaseBlock):
    """Pathway terminal block.

    Cardinality: at least one per pathway version, multiple allowed —
    each terminal branch (e.g. xor decision negative leg) carries its
    own EndPathway. The publish-time validator rejects zero.

    Shape: `input_logic` is REQUIRED to gate completion (the block
    must wait for its upstream conditions). `timing_policy` is
    forbidden — once eligible, the block fires immediately; there is
    no "delay before ending" semantic.

    Runtime semantic: when the first reachable EndPathwayBlock
    execution transitions to `completed`, the parent enrollment is
    flipped to `state=completed` by the enrollment service.
    """

    KIND: ClassVar[str] = "end_pathway"
    TYPE_CODE: ClassVar[str] = "end_pathway"
    LABEL: ClassVar[str] = "End"
    DESCRIPTION: ClassVar[str] = (
        "Terminal block. First reachable end completes the enrollment."
    )
    # `square` — lucide has no plain "stop"; square reads as the stop glyph.
    ICON: ClassVar[str] = "square"
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


__all__ = ["EndPathwayBlock"]
