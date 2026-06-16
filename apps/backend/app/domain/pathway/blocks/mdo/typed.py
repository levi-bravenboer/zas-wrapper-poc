"""MdoBlock — typed `BaseBlock` subclass (pathway-completion § A7).

Multi-disciplinair overleg: exactly **one leading caregiver** +
**unlimited extra** caregivers. The leading caregiver is the
responsible chair; extras contribute optionally.

`leading_caregiver_id` is NOT a template field — it binds at runtime
(defaults to `enrollment.assigned_caregiver_id`, overridable via a
future "reassign MDO leader" action, out of PoC).

Runtime semantics (lands in the "pathway-nested-runtime" PR):

- Extra caregivers fire `record_event(execution_id, "contributed",
  payload={caregiver_id})` — appends to `result_json.contributors`
  (de-duped) WITHOUT state transitions.
- The leading caregiver completes the block via
  `complete_execution(result={contributors, notes, closed_at})` —
  standard `active → completed` transition. No `n_of_m` gate.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER


class MdoResult(BaseModel):
    """Typed completion payload for an `MdoBlock` execution.

    `contributors` is the de-duped list of caregivers who fired the
    `contributed` event — always includes the leading caregiver who
    closes the MDO.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    contributors: list[UUID]
    notes: str
    closed_at: datetime


class MdoBlock(BaseBlock):
    """Multi-disciplinair overleg block.

    Per-template fields:

    - `topic`: required — what the MDO is about ("Bespreking
      pathologie-uitslag", …).
    - `expected_attendees_note`: optional free-text guidance for the
      leading caregiver on who to invite ("oncoloog + radioloog").
      Advisory only — not validated against real users.
    """

    KIND: ClassVar[str] = "mdo"
    TYPE_CODE: ClassVar[str] = "mdo"
    LABEL: ClassVar[str] = "MDO"
    DESCRIPTION: ClassVar[str] = (
        "Multi-disciplinair overleg: one leading caregiver chairs, "
        "unlimited extra caregivers contribute. The leading caregiver "
        "closes the MDO with notes + contributor list."
    )
    ICON: ClassVar[str] = "users"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_CAREGIVER,)
    EVENTS: ClassVar[tuple[str, ...]] = ("contributed",)
    RESULT_TYPE: ClassVar[type | None] = MdoResult
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "topic": {"type": "string", "minLength": 1, "maxLength": 500},
            "expected_attendees_note": {"type": "string", "maxLength": 2000},
        },
        required=["topic"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["topic", "expected_attendees_note"],
    }

    topic: str
    expected_attendees_note: str | None = None


__all__ = ["MdoBlock", "MdoResult"]
