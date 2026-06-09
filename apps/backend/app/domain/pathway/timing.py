"""`TimingPolicy` tagged union per chain slot #2 §4 (parent design D5).

The tagged union sits on `BaseBlock.timing_policy` and answers
"how is this block's schedule anchored?" at template time. The runtime
engine (slot #3) consumes the union to compute concrete
`scheduled_at` instants per enrollment.

Variants:

| Variant                          | When to use                                                |
|----------------------------------|------------------------------------------------------------|
| `FixedDurationPolicy`            | Block has an authored ISO 8601 duration (e.g. appointment) |
| `WaitAfterPolicy`                | Block waits an ISO 8601 offset after eligibility           |
| `DueWithinPolicy`                | Task with an authored "complete within" window             |
| `AtEnrollmentPickedDatePolicy`   | Schedule is the deferred date provided at enrollment       |

The fifth design slot (`marker` anchored) is encoded via the
`input_logic` `wait_after` predicate; timing_policy only owns the
block-level (template) timing knob, not the inter-block connector.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class _PolicyBase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class FixedDurationPolicy(_PolicyBase):
    """Block has a fixed ISO 8601 duration."""

    kind: Literal["fixed_duration"] = "fixed_duration"
    duration_iso: str


class WaitAfterPolicy(_PolicyBase):
    """Block fires after an ISO 8601 offset from its eligibility moment.

    `PT0S` means "fire as soon as eligible" — used as the default
    backfill for rows that carry no authored timing.
    """

    kind: Literal["wait_after"] = "wait_after"
    offset_iso: str = "PT0S"


class DueWithinPolicy(_PolicyBase):
    """Block must complete within an ISO 8601 window of its eligibility."""

    kind: Literal["due_within"] = "due_within"
    window_iso: str


class AtEnrollmentPickedDatePolicy(_PolicyBase):
    """Schedule is the date supplied at enrollment as a deferred field."""

    kind: Literal["at_enrollment_picked_date"] = "at_enrollment_picked_date"


TimingPolicy = Annotated[
    Union[
        FixedDurationPolicy,
        WaitAfterPolicy,
        DueWithinPolicy,
        AtEnrollmentPickedDatePolicy,
    ],
    Field(discriminator="kind"),
]


__all__ = [
    "AtEnrollmentPickedDatePolicy",
    "DueWithinPolicy",
    "FixedDurationPolicy",
    "TimingPolicy",
    "WaitAfterPolicy",
]
