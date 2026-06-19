"""Runtime engine driving `BlockExecution` state transitions (slot #3 §4).

The engine is stateless — every method takes the full aggregate (the
enrollment plus its executions) and returns the mutated aggregate.
Persistence is the caller's concern; the engine never touches the
ORM. This split keeps the state-machine unit-testable without DB
fixtures.

DecisionBlock handling (§4.2):

| mode    | On `complete`                                                            |
|---------|--------------------------------------------------------------------------|
| `xor`   | engine picks the single `decision_output` from the typed result, marks   |
|         | downstream blocks referencing *other* outputs as `skipped`.              |
| `and`   | every output fires; downstream eligibility is re-evaluated independently |
|         | per the targets' own `input_logic` aggregates.                           |

The engine consumes the slot-#2 `InputLogic.evaluate` helper for the
predicate matching; per-rule semantics live in
`app/domain/pathway/input_logic/evaluator.py`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.decision.typed import DecisionBlock
from app.domain.pathway.blocks.end_pathway.typed import EndPathwayBlock
from app.domain.pathway.blocks.start.typed import StartBlock
from app.domain.pathway.input_logic import InputLogic
from app.domain.pathway.input_logic.evaluator import (
    BlockExecutionView,
    PredicateContext,
    evaluate,
)
from app.domain.pathway.input_logic.predicates import (
    DecisionOutputArgs,
    PredicateKind,
)
from app.domain.pathway.runtime.execution import BlockExecution


# Block kinds with no caregiver action that fire automatically on reach.
# The side-effect (message send / Luscii enroll) is mocked here; only the
# state transition + an `auto_fired` marker are applied.
_AUTO_FIRE_KINDS: frozenset[str] = frozenset({"message", "external_program"})


class RuntimeEngine:
    """Pure state-machine driver. No DB / I/O."""

    @staticmethod
    def auto_fire_starts(
        executions: dict[UUID, BlockExecution],
        templates: dict[UUID, BaseBlock],
        *,
        now: datetime,
    ) -> list[UUID]:
        """Force every `StartBlock` execution still in `pending` straight
        through to `completed` (catalogue-expansion § 1).

        Idempotent — non-pending starts are skipped. Stamps
        `started_at` and `completed_at` to `now`. Returns the ids that
        moved so the caller can ship realtime hints. Downstream
        eligibility is left to `evaluate_eligibility`, which will see
        the start as `done` and fire any `if_done(start)` rules in the
        same pass.
        """
        fired: list[UUID] = []
        for exec_id, execution in executions.items():
            if execution.state != "pending":
                continue
            template = templates.get(execution.block_template_id)
            if not isinstance(template, StartBlock):
                continue
            execution.transition("eligible")
            execution.transition("active")
            execution.started_at = now
            execution.transition("completed")
            execution.completed_at = now
            fired.append(exec_id)
        return fired

    @staticmethod
    def auto_fire_system(
        executions: dict[UUID, BlockExecution],
        templates: dict[UUID, BaseBlock],
        *,
        now: datetime,
    ) -> list[UUID]:
        """Force `eligible` system/auto blocks straight through to `completed`.

        Covers `message` (mock-send, logged) and `external_program`
        (auto-enroll on reach) — neither carries a caregiver action,
        so they fire as soon as they are eligible and their timing has
        elapsed. The mock side-effect is recorded as an `auto_fired`
        marker on `result_json`; the real send / Luscii enroll lands
        with the materialization activities (tasks 3.5/3.10). Idempotent
        — already-fired blocks are skipped. Returns the ids that moved.
        """
        fired: list[UUID] = []
        for exec_id, execution in executions.items():
            if execution.state != "eligible":
                continue
            template = templates.get(execution.block_template_id)
            if template is None or template.KIND not in _AUTO_FIRE_KINDS:
                continue
            # Honour timing: an eligible block whose schedule has not
            # elapsed waits (mirrors the tab's Upcoming bucket).
            if execution.scheduled_at is not None and execution.scheduled_at > now:
                continue
            execution.transition("active")
            execution.started_at = now
            execution.transition("completed")
            execution.completed_at = now
            execution.result_json = {"auto_fired": template.KIND}
            fired.append(exec_id)
        return fired

    @staticmethod
    def auto_fire_end(
        executions: dict[UUID, BlockExecution],
        templates: dict[UUID, BaseBlock],
        *,
        now: datetime,
    ) -> list[UUID]:
        """Force `eligible` `end_pathway` blocks through to `completed`.

        End blocks carry no caregiver action — they fire as soon as
        they are reachable. The caller (enrollment service) flips the
        enrollment to `completed` when this returns a non-empty list.
        Idempotent. Returns the ids that moved.
        """
        fired: list[UUID] = []
        for exec_id, execution in executions.items():
            if execution.state != "eligible":
                continue
            template = templates.get(execution.block_template_id)
            if not isinstance(template, EndPathwayBlock):
                continue
            execution.transition("active")
            execution.started_at = now
            execution.transition("completed")
            execution.completed_at = now
            fired.append(exec_id)
        return fired

    @staticmethod
    def evaluate_eligibility(
        executions: dict[UUID, BlockExecution],
        templates: dict[UUID, BaseBlock],
        *,
        now: datetime | None = None,
    ) -> list[UUID]:
        """Walk every `pending` execution and flip eligible ones.

        `now` feeds time-anchored predicates (`if_not_done_within`);
        callers that don't pass it keep the pre-§B1 behaviour (those
        predicates evaluate to False until a clocked pass runs).

        Returns the ids that transitioned to `eligible` so the caller
        can ship realtime hints without a full diff.
        """
        ctx = _build_context(executions, templates, now=now)
        promoted: list[UUID] = []
        for exec_id, execution in executions.items():
            if execution.state != "pending":
                continue
            template = templates.get(execution.block_template_id)
            if template is None:
                continue
            if not _input_logic_satisfied(template.input_logic, ctx):
                continue
            execution.transition("eligible")
            promoted.append(exec_id)
        return promoted

    @staticmethod
    def start(execution: BlockExecution, *, now: datetime) -> None:
        """Transition `eligible → active` and stamp `started_at`."""
        execution.transition("active")
        execution.started_at = now

    @staticmethod
    def complete(
        executions: dict[UUID, BlockExecution],
        templates: dict[UUID, BaseBlock],
        execution_id: UUID,
        *,
        result: dict[str, Any] | None,
        now: datetime,
    ) -> list[UUID]:
        """Transition `active → completed`, fire DecisionBlock fanout, then
        re-evaluate eligibility for every still-pending downstream block.

        Returns the ids that transitioned to `eligible` as a result.
        """
        execution = executions[execution_id]
        execution.result_json = result
        execution.completed_at = now
        execution.transition("completed")

        template = templates.get(execution.block_template_id)
        if isinstance(template, DecisionBlock):
            _apply_decision_fanout(execution, template, executions, templates)

        return RuntimeEngine.evaluate_eligibility(executions, templates, now=now)

    @staticmethod
    def skip(execution: BlockExecution, *, reason: str | None = None) -> None:
        """Admin override — transition `pending | eligible → skipped`."""
        del reason  # plumbed via the API layer for audit, not the engine
        execution.transition("skipped")


def _build_context(
    executions: dict[UUID, BlockExecution],
    templates: dict[UUID, BaseBlock],
    *,
    now: datetime | None = None,
) -> PredicateContext:
    block_views: dict[UUID, BlockExecutionView] = {}
    for execution in executions.values():
        template_id = execution.block_template_id
        produced = (
            execution.result_json
            if execution.state == "completed" and execution.result_json is not None
            else {}
        )
        block_views[template_id] = BlockExecutionView(
            block_id=template_id,
            done=execution.state == "completed",
            produced=produced,
            decision_output=execution.decision_output,
            terminal=execution.is_terminal(),
            # §B1 SLA anchor: `scheduled_at` stands in for the
            # eligibility moment until a dedicated `eligible_at`
            # runtime column lands (pathway-nested-runtime PR).
            sla_anchor_at=execution.scheduled_at,
        )
    # markers are out of scope for slot #3 — runtime marker resolution
    # lands with the scheduler layer (downstream).
    return PredicateContext(blocks=block_views, markers={}, now=now)


def _input_logic_satisfied(
    logic: InputLogic,
    ctx: PredicateContext,
) -> bool:
    """Wrapper that hides the slot-#2 evaluator import from callers."""
    return evaluate(logic, ctx)


def _apply_decision_fanout(
    execution: BlockExecution,
    template: DecisionBlock,
    executions: dict[UUID, BlockExecution],
    templates: dict[UUID, BaseBlock],
) -> None:
    """Resolve a DecisionBlock completion and propagate to dependents.

    The typed `result_json` is expected to carry `output_key`
    (validated upstream); `mode="xor"` prunes dependents whose
    `InputLogic` cannot any longer evaluate to `True` once the
    decision has resolved.

    Earlier versions skipped a dependent on the first mismatched
    `decision_output` rule, which is wrong under `any_of` /
    `n_of_m` aggregators — those rules are individually-falsifiable
    but collectively-satisfiable. The fix asks the slot-#2 evaluator
    whether the aggregate can still resolve to `True` given the
    upstream's settled `decision_output`; only blocks for which it
    cannot are skipped (covers both `pending` and the
    `eligible → skipped` arm called out in the state machine table).
    """
    result = execution.result_json or {}
    output_key = result.get("output_key") if isinstance(result, dict) else None
    if not isinstance(output_key, str) or output_key not in template.outputs:
        # The publish gate guarantees `outputs` is non-empty; the
        # client supplying a foreign key gets caught by the API
        # validator before reaching the engine.
        return
    execution.decision_output = output_key

    if template.mode != "xor":
        return

    ctx = _build_context(executions, templates)
    for downstream in executions.values():
        if downstream.state not in {"pending", "eligible"}:
            continue
        downstream_template = templates.get(downstream.block_template_id)
        if downstream_template is None:
            continue
        if not _references_decision(downstream_template.input_logic, execution.block_template_id):
            continue
        if _max_satisfiable(downstream_template.input_logic, ctx):
            continue
        downstream.transition("skipped")


def _references_decision(logic: InputLogic, decision_template_id: UUID) -> bool:
    """True when any rule on `logic` reads outputs from `decision_template_id`."""
    for rule in logic.rules:
        args = rule.args
        if args.predicate is not PredicateKind.DECISION_OUTPUT:
            continue
        assert isinstance(args, DecisionOutputArgs)
        if args.after_block == decision_template_id:
            return True
    return False


def _max_satisfiable(logic: InputLogic, ctx: PredicateContext) -> bool:
    """Optimistic eligibility — could `logic` ever evaluate True given `ctx`?

    Treats every non-decision-output rule whose upstream hasn't
    completed yet as potentially-true (the engine doesn't know the
    final result yet, so the downstream stays alive). Decision-output
    rules whose producer has resolved use the resolved output_key.
    """
    rules = logic.rules
    if not rules:
        return True

    results: list[bool] = []
    for rule in rules:
        results.append(_max_truth(rule.args, ctx))

    if logic.n_of_m is not None:
        threshold, total = logic.n_of_m
        if total != len(rules):
            return True  # publish gate catches the mismatch; stay tolerant here
        return sum(1 for r in results if r) >= threshold

    if logic.aggregator == "any_of":
        return any(results)
    return all(results)


def _max_truth(args: object, ctx: PredicateContext) -> bool:
    """Could this single rule's args evaluate True given the current ctx?"""
    if isinstance(args, DecisionOutputArgs):
        view = ctx.blocks.get(args.after_block)
        # Producer hasn't fired its output yet → still satisfiable
        # (the engine will re-check when the upstream completes).
        if view is None or not view.done or view.decision_output is None:
            return True
        return view.decision_output == args.output_key
    # Everything else stays optimistic — the engine doesn't know the
    # final inputs at decision-fanout time.
    return True


__all__ = ["RuntimeEngine"]
