"""Predicate vocabulary + evaluator unit tests (chain slot #2 §1)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.domain.pathway.input_logic import (
    DecisionOutputArgs,
    HasDataArgs,
    IfDoneArgs,
    IfNotDoneWithinArgs,
    InputLogic,
    InputLogicRule,
    PredicateKind,
    ValueEqualsArgs,
    ValueGtArgs,
    WaitAfterArgs,
)
from app.domain.pathway.input_logic.evaluator import (
    BlockExecutionView,
    MarkerView,
    PredicateContext,
    evaluate,
    evaluate_rule,
)


def _block(block_id, *, done: bool, produced=None, decision_output=None):
    return BlockExecutionView(
        block_id=block_id,
        done=done,
        produced=produced or {},
        decision_output=decision_output,
    )


def _ctx(*views: BlockExecutionView, markers: tuple[MarkerView, ...] = ()) -> PredicateContext:
    return PredicateContext(
        blocks={v.block_id: v for v in views},
        markers={m.marker_id: m for m in markers},
    )


# ---- IF_DONE --------------------------------------------------------------


def test_if_done_true_when_upstream_completed() -> None:
    upstream = uuid4()
    rule = InputLogicRule(node=upstream, args=IfDoneArgs(after_block=upstream))
    assert evaluate_rule(rule, _ctx(_block(upstream, done=True))) is True


def test_if_done_false_when_upstream_pending() -> None:
    upstream = uuid4()
    rule = InputLogicRule(node=upstream, args=IfDoneArgs(after_block=upstream))
    assert evaluate_rule(rule, _ctx(_block(upstream, done=False))) is False


def test_if_done_false_when_upstream_missing_from_context() -> None:
    upstream = uuid4()
    rule = InputLogicRule(node=upstream, args=IfDoneArgs(after_block=upstream))
    assert evaluate_rule(rule, _ctx()) is False


# ---- HAS_DATA -------------------------------------------------------------


def test_has_data_true_when_field_present() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=HasDataArgs(block=upstream, field_path="location"),
    )
    ctx = _ctx(_block(upstream, done=True, produced={"location": "Room 12"}))
    assert evaluate_rule(rule, ctx) is True


def test_has_data_false_when_field_null() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=HasDataArgs(block=upstream, field_path="location"),
    )
    ctx = _ctx(_block(upstream, done=True, produced={"location": None}))
    assert evaluate_rule(rule, ctx) is False


def test_has_data_walks_nested_path() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=HasDataArgs(block=upstream, field_path="address.city"),
    )
    ctx = _ctx(_block(upstream, done=True, produced={"address": {"city": "Antwerp"}}))
    assert evaluate_rule(rule, ctx) is True


def test_has_data_false_when_upstream_pending() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=HasDataArgs(block=upstream, field_path="location"),
    )
    ctx = _ctx(_block(upstream, done=False, produced={"location": "Room 12"}))
    assert evaluate_rule(rule, ctx) is False


# ---- VALUE_EQUALS / VALUE_GT ---------------------------------------------


def test_value_equals_true_on_match() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=ValueEqualsArgs(block=upstream, field_path="status", expected="ok"),
    )
    ctx = _ctx(_block(upstream, done=True, produced={"status": "ok"}))
    assert evaluate_rule(rule, ctx) is True


def test_value_equals_no_coercion() -> None:
    """`"42" != 42` — strict equality keeps publish-time validation honest."""
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=ValueEqualsArgs(block=upstream, field_path="count", expected=42),
    )
    ctx = _ctx(_block(upstream, done=True, produced={"count": "42"}))
    assert evaluate_rule(rule, ctx) is False


def test_value_gt_true_when_above_threshold() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=ValueGtArgs(block=upstream, field_path="score", threshold=5.0),
    )
    ctx = _ctx(_block(upstream, done=True, produced={"score": 7}))
    assert evaluate_rule(rule, ctx) is True


def test_value_gt_false_when_non_numeric() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=ValueGtArgs(block=upstream, field_path="score", threshold=5.0),
    )
    ctx = _ctx(_block(upstream, done=True, produced={"score": "high"}))
    assert evaluate_rule(rule, ctx) is False


# ---- WAIT_AFTER -----------------------------------------------------------


def test_wait_after_true_when_marker_reached() -> None:
    marker = uuid4()
    rule = InputLogicRule(
        node=uuid4(),
        args=WaitAfterArgs(marker_id=marker, offset_iso="P3D", direction="after"),
    )
    ctx = _ctx(markers=(MarkerView(marker_id=marker, reached=True),))
    assert evaluate_rule(rule, ctx) is True


def test_wait_after_false_when_marker_unreached() -> None:
    marker = uuid4()
    rule = InputLogicRule(
        node=uuid4(),
        args=WaitAfterArgs(marker_id=marker, offset_iso="P3D", direction="after"),
    )
    ctx = _ctx(markers=(MarkerView(marker_id=marker, reached=False),))
    assert evaluate_rule(rule, ctx) is False


# ---- DECISION_OUTPUT ------------------------------------------------------


def test_decision_output_true_on_matching_key() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=DecisionOutputArgs(after_block=upstream, output_key="high_risk"),
    )
    ctx = _ctx(_block(upstream, done=True, decision_output="high_risk"))
    assert evaluate_rule(rule, ctx) is True


def test_decision_output_false_on_other_key() -> None:
    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=DecisionOutputArgs(after_block=upstream, output_key="high_risk"),
    )
    ctx = _ctx(_block(upstream, done=True, decision_output="low_risk"))
    assert evaluate_rule(rule, ctx) is False


# ---- Aggregator + n_of_m --------------------------------------------------


def test_empty_input_logic_is_true() -> None:
    assert evaluate(InputLogic(), _ctx()) is True


def test_all_of_requires_every_rule() -> None:
    a, b = uuid4(), uuid4()
    logic = InputLogic(
        rules=[
            InputLogicRule(node=a, args=IfDoneArgs(after_block=a)),
            InputLogicRule(node=b, args=IfDoneArgs(after_block=b)),
        ],
        aggregator="all_of",
    )
    assert evaluate(logic, _ctx(_block(a, done=True), _block(b, done=True))) is True
    assert evaluate(logic, _ctx(_block(a, done=True), _block(b, done=False))) is False


def test_any_of_requires_at_least_one_rule() -> None:
    a, b = uuid4(), uuid4()
    logic = InputLogic(
        rules=[
            InputLogicRule(node=a, args=IfDoneArgs(after_block=a)),
            InputLogicRule(node=b, args=IfDoneArgs(after_block=b)),
        ],
        aggregator="any_of",
    )
    assert evaluate(logic, _ctx(_block(a, done=False), _block(b, done=True))) is True
    assert evaluate(logic, _ctx(_block(a, done=False), _block(b, done=False))) is False


def test_n_of_m_threshold() -> None:
    a, b, c = uuid4(), uuid4(), uuid4()
    logic = InputLogic(
        rules=[
            InputLogicRule(node=a, args=IfDoneArgs(after_block=a)),
            InputLogicRule(node=b, args=IfDoneArgs(after_block=b)),
            InputLogicRule(node=c, args=IfDoneArgs(after_block=c)),
        ],
        n_of_m=(2, 3),
    )
    assert (
        evaluate(
            logic,
            _ctx(_block(a, done=True), _block(b, done=True), _block(c, done=False)),
        )
        is True
    )
    assert (
        evaluate(
            logic,
            _ctx(_block(a, done=True), _block(b, done=False), _block(c, done=False)),
        )
        is False
    )


def test_n_of_m_total_mismatch_raises() -> None:
    a = uuid4()
    logic = InputLogic(
        rules=[InputLogicRule(node=a, args=IfDoneArgs(after_block=a))],
        n_of_m=(1, 5),  # m=5 doesn't match len(rules)=1
    )
    with pytest.raises(ValueError, match="does not match rule count"):
        evaluate(logic, _ctx(_block(a, done=True)))


# ---- Discriminated union serialisation -----------------------------------


def test_input_logic_round_trips_via_model_dump() -> None:
    upstream = uuid4()
    logic = InputLogic(
        rules=[
            InputLogicRule(
                node=upstream,
                args=DecisionOutputArgs(after_block=upstream, output_key="ok"),
            ),
        ],
    )
    dumped = logic.model_dump(mode="json")
    rebuilt = InputLogic.model_validate(dumped)
    assert rebuilt == logic
    assert dumped["rules"][0]["args"]["predicate"] == PredicateKind.DECISION_OUTPUT.value


# ---- IF_NOT_DONE_WITHIN (pathway-completion § B1) -------------------------


def _sla_ctx(view: BlockExecutionView, *, now) -> PredicateContext:
    return PredicateContext(blocks={view.block_id: view}, markers={}, now=now)


def test_if_not_done_within_false_before_window_expires() -> None:
    from datetime import UTC, datetime

    upstream = uuid4()
    anchor = datetime(2026, 6, 1, tzinfo=UTC)
    rule = InputLogicRule(
        node=upstream,
        args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="P14D"),
    )
    view = BlockExecutionView(block_id=upstream, done=False, terminal=False, sla_anchor_at=anchor)
    not_yet = datetime(2026, 6, 10, tzinfo=UTC)
    assert evaluate_rule(rule, _sla_ctx(view, now=not_yet)) is False


def test_if_not_done_within_true_when_expired_and_still_pending() -> None:
    from datetime import UTC, datetime

    upstream = uuid4()
    anchor = datetime(2026, 6, 1, tzinfo=UTC)
    rule = InputLogicRule(
        node=upstream,
        args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="P14D"),
    )
    view = BlockExecutionView(block_id=upstream, done=False, terminal=False, sla_anchor_at=anchor)
    expired = datetime(2026, 6, 16, tzinfo=UTC)
    assert evaluate_rule(rule, _sla_ctx(view, now=expired)) is True


def test_if_not_done_within_false_when_already_completed() -> None:
    from datetime import UTC, datetime

    upstream = uuid4()
    anchor = datetime(2026, 6, 1, tzinfo=UTC)
    rule = InputLogicRule(
        node=upstream,
        args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="P14D"),
    )
    view = BlockExecutionView(block_id=upstream, done=True, terminal=True, sla_anchor_at=anchor)
    expired = datetime(2026, 6, 16, tzinfo=UTC)
    assert evaluate_rule(rule, _sla_ctx(view, now=expired)) is False


def test_if_not_done_within_false_when_skipped() -> None:
    from datetime import UTC, datetime

    upstream = uuid4()
    anchor = datetime(2026, 6, 1, tzinfo=UTC)
    rule = InputLogicRule(
        node=upstream,
        args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="P14D"),
    )
    # skipped → terminal=True but done=False
    view = BlockExecutionView(block_id=upstream, done=False, terminal=True, sla_anchor_at=anchor)
    expired = datetime(2026, 6, 16, tzinfo=UTC)
    assert evaluate_rule(rule, _sla_ctx(view, now=expired)) is False


def test_if_not_done_within_false_without_clock_or_anchor() -> None:
    from datetime import UTC, datetime

    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="P14D"),
    )
    anchor = datetime(2026, 6, 1, tzinfo=UTC)
    no_anchor = BlockExecutionView(
        block_id=upstream, done=False, terminal=False, sla_anchor_at=None
    )
    with_anchor = BlockExecutionView(
        block_id=upstream, done=False, terminal=False, sla_anchor_at=anchor
    )
    now = datetime(2026, 6, 16, tzinfo=UTC)
    assert evaluate_rule(rule, _sla_ctx(no_anchor, now=now)) is False
    assert evaluate_rule(rule, _sla_ctx(with_anchor, now=None)) is False


def test_if_not_done_within_supports_sub_day_windows() -> None:
    from datetime import UTC, datetime

    upstream = uuid4()
    anchor = datetime(2026, 6, 1, 8, 0, tzinfo=UTC)
    rule = InputLogicRule(
        node=upstream,
        args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="PT4H"),
    )
    view = BlockExecutionView(block_id=upstream, done=False, terminal=False, sla_anchor_at=anchor)
    before = datetime(2026, 6, 1, 11, 0, tzinfo=UTC)
    after = datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
    assert evaluate_rule(rule, _sla_ctx(view, now=before)) is False
    assert evaluate_rule(rule, _sla_ctx(view, now=after)) is True


def test_if_not_done_within_invalid_iso_evaluates_false() -> None:
    from datetime import UTC, datetime

    upstream = uuid4()
    anchor = datetime(2026, 6, 1, tzinfo=UTC)
    rule = InputLogicRule(
        node=upstream,
        args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="14 days"),
    )
    view = BlockExecutionView(block_id=upstream, done=False, terminal=False, sla_anchor_at=anchor)
    now = datetime(2026, 6, 16, tzinfo=UTC)
    assert evaluate_rule(rule, _sla_ctx(view, now=now)) is False


def test_if_not_done_within_round_trips_via_model_dump() -> None:
    upstream = uuid4()
    logic = InputLogic(
        rules=[
            InputLogicRule(
                node=upstream,
                args=IfNotDoneWithinArgs(after_block=upstream, offset_iso="P3D"),
            ),
        ],
    )
    dumped = logic.model_dump(mode="json")
    rebuilt = InputLogic.model_validate(dumped)
    assert rebuilt == logic
    assert dumped["rules"][0]["args"]["predicate"] == "if_not_done_within"


# ---- EVENT (pathway-completion § B3) --------------------------------------


def test_event_rule_matches_recorded_event() -> None:
    from app.domain.pathway.input_logic import EventArgs

    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=EventArgs(after_block=upstream, event_type="rescheduled"),
    )
    view = BlockExecutionView(
        block_id=upstream,
        done=True,
        produced={"events": ["rescheduled"]},
    )
    assert evaluate_rule(rule, _ctx(view)) is True


def test_event_rule_false_without_matching_event() -> None:
    from app.domain.pathway.input_logic import EventArgs

    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=EventArgs(after_block=upstream, event_type="rescheduled"),
    )
    no_events = BlockExecutionView(block_id=upstream, done=True, produced={})
    other_event = BlockExecutionView(
        block_id=upstream,
        done=True,
        produced={"events": ["patient_no_show"]},
    )
    assert evaluate_rule(rule, _ctx(no_events)) is False
    assert evaluate_rule(rule, _ctx(other_event)) is False


def test_event_rule_false_when_block_missing() -> None:
    from app.domain.pathway.input_logic import EventArgs

    upstream = uuid4()
    rule = InputLogicRule(
        node=upstream,
        args=EventArgs(after_block=upstream, event_type="rescheduled"),
    )
    assert evaluate_rule(rule, _ctx()) is False


def test_event_args_round_trip() -> None:
    from app.domain.pathway.input_logic import EventArgs

    upstream = uuid4()
    logic = InputLogic(
        rules=[
            InputLogicRule(
                node=upstream,
                args=EventArgs(after_block=upstream, event_type="contributed"),
            ),
        ],
    )
    dumped = logic.model_dump(mode="json")
    rebuilt = InputLogic.model_validate(dumped)
    assert rebuilt == logic
    assert dumped["rules"][0]["args"]["predicate"] == "event"
