"""TreatmentBlock — typed `BaseBlock` subclass (catalogue-expansion § A4).

A `TreatmentBlock` models an executed clinical procedure (operation,
intervention, treatment session) carried out by a caregiver. It is
distinct from `AppointmentBlock` along two axes:

1. It carries a typed `RESULT_TYPE` (`TreatmentResult`) capturing the
   clinical outcome at completion (`performed_at`, free-text `notes`,
   optional `complications` summary). `AppointmentBlock` has no
   `RESULT_TYPE` and treats completion as an opaque event.
2. It surfaces a `notes` SOP authoring field on the template
   (e.g. "Pre-medication: …; Post-op: …") that the dialog renders for
   caregivers preparing the procedure.

Lifecycle is the standard `pending → eligible → active → completed`
chain — no special transitions. `input_logic` and `timing_policy` are
both unrestricted; `timing_policy` is typically a `FixedDurationPolicy`
matching the planned duration of the procedure.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.lanes import LANE_KIND_CAREGIVER


class TreatmentResult(BaseModel):
    """Typed completion payload for a `TreatmentBlock` execution.

    Stored on `BlockExecution.result_json` when the caregiver marks
    the treatment complete. `RESULT_TYPE` enforcement runs in
    `EnrollmentService.complete_execution`.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    performed_at: datetime
    notes: str | None = None
    complications: str | None = None


class TreatmentBlock(BaseBlock):
    """Caregiver-executed clinical procedure block.

    Per-template fields:

    - `title`: required, max 255 chars — what was performed
      ("Lumbale spinale fusie", "Coloscopie", …).
    - `location`: optional — where it happens.
    - `duration_minutes`: optional — planned duration; the runtime
      tags `BlockExecution.scheduled_at` via `timing_policy`.
    - `notes`: optional SOP / preparation guidance shown to the
      caregiver. Persisted as the `treatment_notes` column via the
      `<KIND>_<field>` mapper convention. Free-text up to 2000 chars.
    """

    KIND: ClassVar[str] = "treatment"
    TYPE_CODE: ClassVar[str] = "treatment"
    LABEL: ClassVar[str] = "Behandeling"
    DESCRIPTION: ClassVar[str] = (
        "An executed clinical procedure (operation, intervention, "
        "treatment session) carried out by a caregiver. Completion "
        "carries a typed result with performed_at, notes, and optional "
        "complications."
    )
    ICON: ClassVar[str] = "stethoscope"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_CAREGIVER,)
    RESULT_TYPE: ClassVar[type | None] = TreatmentResult
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "title": {"type": "string", "minLength": 1, "maxLength": 255},
            "location": {"type": "string", "maxLength": 255},
            "duration_minutes": {"type": "integer", "minimum": 0},
            "notes": {"type": "string", "maxLength": 2000},
        },
        required=["title"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": ["title", "location", "duration_minutes", "notes"],
    }

    title: str
    location: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None


__all__ = ["TreatmentBlock", "TreatmentResult"]
