"""ISO-8601 duration math used to derive `BlockExecution.scheduled_at`
from an enrollment's `anchor_date` + the block's typed `TimingPolicy`
(chain slot #3 §3.2).

Supports the calendar-only subset of ISO-8601 durations the slot-#2
`TimingPolicy` variants emit (`PnY`, `PnM`, `PnW`, `PnD`, `PT0S` for
the no-op case). Time-of-day components are intentionally rejected —
the runtime engine pegs anchored offsets to midnight UTC and lets the
scheduler layer (out of scope here) refine the wall-clock.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta
from typing import Any


_ISO_DURATION = re.compile(
    r"^P(?:(?P<years>\d+)Y)?(?:(?P<months>\d+)M)?"
    r"(?:(?P<weeks>\d+)W)?(?:(?P<days>\d+)D)?"
    r"(?:T(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?)?$"
)


class InvalidIsoDurationError(ValueError):
    """Slot-#3 scheduling helper rejected an ISO-8601 duration string."""


def parse_iso_duration_days(value: str) -> int:
    """Return the number of whole days encoded in `value`.

    Months / years approximate to 30 / 365 days respectively — the
    slot-#3 spec scopes scheduling to calendar arithmetic; calendar-
    aware month math belongs with the scheduler layer that consumes
    `scheduled_at`. Time-of-day components are rejected.
    """
    match = _ISO_DURATION.fullmatch(value)
    if not match:
        raise InvalidIsoDurationError(f"not an ISO 8601 duration: {value!r}")
    parts: dict[str, int] = {
        key: int(group_value) if group_value is not None else 0
        for key, group_value in match.groupdict().items()
    }
    if parts["hours"] or parts["minutes"] or parts["seconds"]:
        raise InvalidIsoDurationError(
            f"time-of-day components unsupported by scheduling helper: {value!r}"
        )
    return parts["years"] * 365 + parts["months"] * 30 + parts["weeks"] * 7 + parts["days"]


def schedule_from_anchor(
    anchor: date,
    policy: dict[str, Any] | None,
) -> tuple[datetime | None, datetime | None]:
    """Return `(scheduled_at, due_at)` for a block's TimingPolicy at enrollment.

    | Policy variant                  | scheduled_at                   | due_at              |
    |---------------------------------|--------------------------------|---------------------|
    | `wait_after`                    | anchor + offset_iso            | None                |
    | `fixed_duration`                | anchor                         | None                |
    | `due_within`                    | anchor                         | anchor + window_iso |
    | `at_enrollment_picked_date`     | None (mirrored from def field) | None                |
    | None (no policy)                | anchor                         | None                |
    """
    anchor_dt = datetime(anchor.year, anchor.month, anchor.day, tzinfo=UTC)

    if policy is None:
        return anchor_dt, None

    kind = policy.get("kind")
    if kind == "wait_after":
        offset = parse_iso_duration_days(str(policy.get("offset_iso", "PT0S")))
        return anchor_dt + timedelta(days=offset), None
    if kind == "fixed_duration":
        return anchor_dt, None
    if kind == "due_within":
        window = parse_iso_duration_days(str(policy.get("window_iso", "PT0S")))
        return anchor_dt, anchor_dt + timedelta(days=window)
    if kind == "at_enrollment_picked_date":
        return None, None
    raise InvalidIsoDurationError(f"unknown TimingPolicy kind: {kind!r}")


__all__ = [
    "InvalidIsoDurationError",
    "parse_iso_duration_days",
    "schedule_from_anchor",
]
