"""Anchor-date relative scheduling tests (chain slot #3 §7.4)."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from app.domain.pathway.runtime.scheduling import (
    InvalidIsoDurationError,
    parse_iso_duration_days,
    schedule_from_anchor,
)


def test_parse_pt0s_is_zero_days() -> None:
    assert parse_iso_duration_days("PT0S") == 0


def test_parse_calendar_components() -> None:
    assert parse_iso_duration_days("P3D") == 3
    assert parse_iso_duration_days("P2W") == 14
    assert parse_iso_duration_days("P1M") == 30
    assert parse_iso_duration_days("P1Y") == 365
    assert parse_iso_duration_days("P1Y2M3W4D") == 365 + 60 + 21 + 4


def test_parse_rejects_time_of_day() -> None:
    with pytest.raises(InvalidIsoDurationError):
        parse_iso_duration_days("PT1H")


def test_parse_rejects_garbage() -> None:
    with pytest.raises(InvalidIsoDurationError):
        parse_iso_duration_days("3 days")


# ---- schedule_from_anchor ------------------------------------------------


_ANCHOR = date(2026, 6, 10)
_ANCHOR_DT = datetime(2026, 6, 10, tzinfo=UTC)


def test_no_policy_schedules_at_anchor() -> None:
    sched, due = schedule_from_anchor(_ANCHOR, None)
    assert sched == _ANCHOR_DT
    assert due is None


def test_wait_after_policy_offsets_from_anchor() -> None:
    sched, due = schedule_from_anchor(
        _ANCHOR,
        {"kind": "wait_after", "offset_iso": "P5D"},
    )
    assert sched == _ANCHOR_DT + timedelta(days=5)
    assert due is None


def test_fixed_duration_pegs_to_anchor() -> None:
    sched, due = schedule_from_anchor(
        _ANCHOR,
        {"kind": "fixed_duration", "duration_iso": "P3D"},
    )
    assert sched == _ANCHOR_DT
    assert due is None


def test_due_within_sets_due_at() -> None:
    sched, due = schedule_from_anchor(
        _ANCHOR,
        {"kind": "due_within", "window_iso": "P7D"},
    )
    assert sched == _ANCHOR_DT
    assert due == _ANCHOR_DT + timedelta(days=7)


def test_at_enrollment_picked_date_defers_scheduling() -> None:
    sched, due = schedule_from_anchor(
        _ANCHOR,
        {"kind": "at_enrollment_picked_date"},
    )
    assert sched is None
    assert due is None


def test_unknown_kind_raises() -> None:
    with pytest.raises(InvalidIsoDurationError):
        schedule_from_anchor(_ANCHOR, {"kind": "made_up"})
