"""Runtime evaluator for `InputLogic` rules (chain slot #2 §1.4).

The evaluator is pure: it walks an `InputLogic` aggregate against a
`PredicateContext` view of upstream block executions + their produced
fields, and returns a boolean. The runtime engine (slot #3) builds the
context per enrollment / per evaluation tick; here we only encode the
predicate semantics.

The split keeps slot #2 reviewable in isolation — every predicate is
unit-testable against a hand-built context without runtime infra.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.domain.pathway.input_logic.predicates import (
    DecisionOutputArgs,
    HasDataArgs,
    IfDoneArgs,
    InputLogic,
    InputLogicRule,
    PredicateKind,
    ValueEqualsArgs,
    ValueGtArgs,
    WaitAfterArgs,
)


@dataclass(frozen=True)
class BlockExecutionView:
    """Snapshot of one upstream block's runtime state, as the evaluator sees it.

    `done` is the boolean "this block has completed its work".
    `produced` is the typed-field bag the block exposed at completion
    time (e.g. `{"location": "Room 12", "scheduled_at": <iso>}`).
    `decision_output` is set when the producer is a `DecisionBlock`
    that fired a typed output; the value is the `output_key` it picked.
    """

    block_id: UUID
    done: bool
    produced: dict[str, Any] = field(default_factory=dict)
    decision_output: str | None = None


@dataclass(frozen=True)
class MarkerView:
    """Snapshot of a `pathway_time_marker` reach state."""

    marker_id: UUID
    reached: bool


@dataclass(frozen=True)
class PredicateContext:
    """Resolved upstream state at one evaluation tick.

    `blocks` maps block id → execution snapshot. `markers` maps marker
    id → reach state for `wait_after` rules. The runtime engine
    constructs this per enrollment + per tick; tests build it inline.
    """

    blocks: dict[UUID, BlockExecutionView] = field(default_factory=dict)
    markers: dict[UUID, MarkerView] = field(default_factory=dict)


def _walk_field_path(produced: dict[str, Any], path: str) -> tuple[bool, Any]:
    """Walk a dot-separated path into `produced`.

    Returns `(present, value)`. `present` is `False` when any segment
    is missing or the leaf is `None`; matches the `has_data`
    semantics.
    """
    cursor: Any = produced
    for part in path.split("."):
        if not isinstance(cursor, dict) or part not in cursor:
            return False, None
        cursor = cursor[part]
    return cursor is not None, cursor


def evaluate_rule(rule: InputLogicRule, ctx: PredicateContext) -> bool:
    """Evaluate one `InputLogicRule` against the context.

    Unknown referenced blocks / markers evaluate to `False`. The
    evaluator never raises on a missing reference — the publish-time
    validator (§3.4) is the gate that proves every reference resolves.
    """
    args = rule.args
    match args.predicate:
        case PredicateKind.IF_DONE:
            assert isinstance(args, IfDoneArgs)
            view = ctx.blocks.get(args.after_block)
            return view is not None and view.done

        case PredicateKind.HAS_DATA:
            assert isinstance(args, HasDataArgs)
            view = ctx.blocks.get(args.block)
            if view is None or not view.done:
                return False
            present, _ = _walk_field_path(view.produced, args.field_path)
            return present

        case PredicateKind.VALUE_EQUALS:
            assert isinstance(args, ValueEqualsArgs)
            view = ctx.blocks.get(args.block)
            if view is None or not view.done:
                return False
            present, value = _walk_field_path(view.produced, args.field_path)
            return present and value == args.expected

        case PredicateKind.VALUE_GT:
            assert isinstance(args, ValueGtArgs)
            view = ctx.blocks.get(args.block)
            if view is None or not view.done:
                return False
            present, value = _walk_field_path(view.produced, args.field_path)
            if not present:
                return False
            try:
                return float(value) > args.threshold
            except (TypeError, ValueError):
                return False

        case PredicateKind.WAIT_AFTER:
            assert isinstance(args, WaitAfterArgs)
            marker = ctx.markers.get(args.marker_id)
            # Marker reach is the design-time gate; the runtime engine
            # converts `(reached_at + offset_iso, direction)` into a
            # schedulable instant. Here we only assert the marker
            # itself has been reached — temporal arithmetic lives at
            # runtime (slot #3).
            return marker is not None and marker.reached

        case PredicateKind.DECISION_OUTPUT:
            assert isinstance(args, DecisionOutputArgs)
            view = ctx.blocks.get(args.after_block)
            return (
                view is not None
                and view.done
                and view.decision_output == args.output_key
            )


def evaluate(logic: InputLogic, ctx: PredicateContext) -> bool:
    """Evaluate an `InputLogic` aggregate against the context.

    Empty rule lists default to `True` (no gating). `n_of_m` overrides
    the aggregator when set: requires at least `n` of `m` rules to
    pass. The `m` value is checked against `len(rules)` for sanity.
    """
    if not logic.rules:
        return True

    results = [evaluate_rule(rule, ctx) for rule in logic.rules]

    if logic.n_of_m is not None:
        threshold, expected_total = logic.n_of_m
        if expected_total != len(logic.rules):
            raise ValueError(
                f"InputLogic.n_of_m total {expected_total} does not match "
                f"rule count {len(logic.rules)}"
            )
        return sum(1 for r in results if r) >= threshold

    if logic.aggregator == "any_of":
        return any(results)
    return all(results)


__all__ = [
    "BlockExecutionView",
    "MarkerView",
    "PredicateContext",
    "evaluate",
    "evaluate_rule",
]
