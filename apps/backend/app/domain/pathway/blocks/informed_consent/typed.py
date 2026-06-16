"""InformedConsentBlock — typed `BaseBlock` subclass (pathway-completion § A8).

Two-actor lifecycle block: the caregiver authors + the runtime sends a
consent request to the patient; the patient receives, opens, and signs.
The block completes when the patient signs (`consented=true`) or when
the optional expiry window elapses without a signature
(`consented=false, expired=true`). **No new terminal state** — expiry
completes the execution with an `expired` result so downstream branches
gate on `result_field_equals(consent_block, "expired", true)`.

Reminder semantics: the runtime re-sends the request every
`reminder_offset_iso` while the block is `eligible` and
`reminders_sent < reminder_max`. `reminder_max` is a spam-cap, NOT a
lifecycle gate — when the cap is hit and no `expires_at_iso` is set,
the block stays `eligible` and the patient can still sign. Authors who
want a hard deadline set `expires_at_iso`.

Runtime sends + reminder/expiry ticks land in the follow-up
"pathway-nested-runtime" PR; this module is the authoring surface.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.pathway._helpers import object_schema
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.form.typed import FormQuestion, _FORM_QUESTION_SCHEMA
from app.domain.pathway.lanes import LANE_KIND_PATIENT


InformedConsentChannel = Literal["email", "sms", "push", "in_app"]

_CHANNELS: tuple[str, ...] = ("email", "sms", "push", "in_app")


class InformedConsentResult(BaseModel):
    """Typed completion payload for an `InformedConsentBlock` execution.

    `consented` and `expired` are mutually exclusive: a signature and a
    timeout can never both be true. `signed_at` + `responses` are only
    present on the consent path.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    consented: bool
    expired: bool
    signed_at: datetime | None = None
    responses: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _consented_expired_mutually_exclusive(self) -> "InformedConsentResult":
        if self.consented and self.expired:
            raise ValueError("consented and expired are mutually exclusive")
        return self


class InformedConsentBlock(BaseBlock):
    """Patient consent request with built-in reminders + optional expiry.

    Per-template fields:

    - `questions`: the consent form (FormQuestion list); defaults to a
      single yes/no "Ik geef toestemming".
    - `channels`: which channels the notification + reminders use
      (≥ 1 of email / sms / push / in_app).
    - `reminder_offset_iso`: ISO 8601 duration between reminders.
    - `reminder_max`: hard cap on reminders (0..10). Spam-cap only.
    - `expires_at_iso`: optional ISO 8601 duration from the block's
      eligibility moment; elapsing completes the block with
      `expired=true`.

    `timing_policy` is forbidden — the lifecycle (send, remind,
    expire) is owned by the per-kind fields above, enforced by
    `validate_informed_consent_invariants` at publish time.
    """

    KIND: ClassVar[str] = "informed_consent"
    TYPE_CODE: ClassVar[str] = "informed_consent"
    LABEL: ClassVar[str] = "Informed consent"
    DESCRIPTION: ClassVar[str] = (
        "Two-actor consent request: the runtime notifies the patient, "
        "the patient signs. Built-in reminders and optional expiry."
    )
    ICON: ClassVar[str] = "signature"
    allowed_lane_kinds: ClassVar[tuple[str, ...]] = (LANE_KIND_PATIENT,)
    RESULT_TYPE: ClassVar[type | None] = InformedConsentResult
    CONFIG_SCHEMA: ClassVar[dict[str, Any]] = object_schema(
        properties={
            "questions": {
                "type": "array",
                "minItems": 1,
                "items": _FORM_QUESTION_SCHEMA,
            },
            "channels": {
                "type": "array",
                "minItems": 1,
                "uniqueItems": True,
                "items": {"type": "string", "enum": list(_CHANNELS)},
            },
            "reminder_offset_iso": {"type": "string", "maxLength": 63},
            "reminder_max": {"type": "integer", "minimum": 0, "maximum": 10},
            "expires_at_iso": {
                "type": ["string", "null"],
                "maxLength": 63,
            },
        },
        required=["questions"],
    )
    UI_SCHEMA: ClassVar[dict[str, Any]] = {
        "order": [
            "questions",
            "channels",
            "reminder_offset_iso",
            "reminder_max",
            "expires_at_iso",
        ],
        "widgets": {"questions": "form-questions"},
    }

    questions: list[FormQuestion] = Field(
        default_factory=lambda: [
            FormQuestion(
                id="consent",
                type="single_choice",
                label="Ik geef toestemming",
                required=True,
            ),
        ],
        min_length=1,
    )
    channels: list[InformedConsentChannel] = Field(
        default_factory=lambda: ["email", "push"],
        min_length=1,
    )
    reminder_offset_iso: str = "P3D"
    reminder_max: int = Field(default=3, ge=0, le=10)
    expires_at_iso: str | None = None


__all__ = [
    "InformedConsentBlock",
    "InformedConsentChannel",
    "InformedConsentResult",
]
