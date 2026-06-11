"""Runtime engine state-machine tests (chain slot #3 §4.3 / §7.1 + §7.3)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.domain.pathway.blocks.appointment.typed import AppointmentBlock
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.decision.typed import DecisionBlock
from app.domain.pathway.blocks.start.typed import StartBlock
from app.domain.pathway.blocks.task.typed import TaskBlock
from app.domain.pathway.input_logic import (
    DecisionOutputArgs,
    IfDoneArgs,
    InputLogic,
    InputLogicRule,
)
from app.domain.pathway.runtime.execution import (
    BlockExecution,
    InvalidTransitionError,
)
from app.services.pathway.runtime.engine import RuntimeEngine


_NOW = datetime(2026, 6, 10, 12, 0, tzinfo=UTC)


def make_execution(template_id: UUID, *, state: str = "pending", result: dict | None = None) -> BlockExecution:
    return BlockExecution(
        id=uuid4(),
        enrollment_id=uuid4(),
        block_template_id=template_id,
        state=state,  # type: ignore[arg-type]
        result_json=result,
    )


# ---- State machine -------------------------------------------------------


def test_state_machine_allows_canonical_path() -> None:
    e = make_execution(uuid4())
    e.transition("eligible")
    e.transition("active")
    e.transition("completed")
    assert e.state == "completed"
    assert e.is_terminal()


def test_state_machine_rejects_skipping_eligible() -> None:
    e = make_execution(uuid4())
    with pytest.raises(InvalidTransitionError):
        e.transition("active")


def test_state_machine_terminal_rejects_outbound() -> None:
    e = make_execution(uuid4(), state="completed")
    with pytest.raises(InvalidTransitionError):
        e.transition("active")


# ---- auto_fire_starts (catalogue-expansion § 1) -------------------------


def test_auto_fire_starts_lands_start_at_completed() -> None:
    start_id = uuid4()
    template = StartBlock(name="Start")
    run = make_execution(start_id)
    executions = {run.id: run}
    fired = RuntimeEngine.auto_fire_starts(
        executions, {start_id: template}, now=_NOW
    )
    assert fired == [run.id]
    assert run.state == "completed"
    assert run.started_at == _NOW
    assert run.completed_at == _NOW


def test_auto_fire_starts_is_idempotent() -> None:
    start_id = uuid4()
    template = StartBlock(name="Start")
    run = make_execution(start_id)
    executions = {run.id: run}
    RuntimeEngine.auto_fire_starts(executions, {start_id: template}, now=_NOW)
    fired_again = RuntimeEngine.auto_fire_starts(
        executions, {start_id: template}, now=_NOW
    )
    assert fired_again == []
    assert run.state == "completed"


def test_auto_fire_starts_makes_if_done_downstream_eligible() -> None:
    start_id = uuid4()
    follow_id = uuid4()
    start = StartBlock(name="Start")
    follow = AppointmentBlock(
        name="Intake",
        title="Intake",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(node=start_id, args=IfDoneArgs(after_block=start_id)),
            ],
        ),
    )
    start_run = make_execution(start_id)
    follow_run = make_execution(follow_id)
    executions = {start_run.id: start_run, follow_run.id: follow_run}
    templates: dict[UUID, BaseBlock] = {start_id: start, follow_id: follow}

    RuntimeEngine.auto_fire_starts(executions, templates, now=_NOW)
    RuntimeEngine.evaluate_eligibility(executions, templates)

    assert start_run.state == "completed"
    assert follow_run.state == "eligible"


def test_auto_fire_starts_ignores_non_start_blocks() -> None:
    intake_id = uuid4()
    template = AppointmentBlock(name="Intake", title="Intake")
    run = make_execution(intake_id)
    executions = {run.id: run}
    fired = RuntimeEngine.auto_fire_starts(
        executions, {intake_id: template}, now=_NOW
    )
    assert fired == []
    assert run.state == "pending"


# ---- evaluate_eligibility ------------------------------------------------


def test_eligibility_empty_input_logic_promotes_immediately() -> None:
    template_id = uuid4()
    template = AppointmentBlock(name="Intake", title="Intake")
    executions = {uuid4(): make_execution(template_id)}
    promoted = RuntimeEngine.evaluate_eligibility(executions, {template_id: template})
    assert len(promoted) == 1
    assert list(executions.values())[0].state == "eligible"


def test_eligibility_waits_for_if_done() -> None:
    intake_id = uuid4()
    followup_id = uuid4()
    intake = AppointmentBlock(name="Intake", title="Intake")
    followup = AppointmentBlock(
        name="Follow-up",
        title="Follow-up",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=intake_id,
                    args=IfDoneArgs(after_block=intake_id),
                ),
            ],
        ),
    )
    intake_run = make_execution(intake_id)
    followup_run = make_execution(followup_id)
    executions = {intake_run.id: intake_run, followup_run.id: followup_run}
    templates: dict[UUID, BaseBlock] = {intake_id: intake, followup_id: followup}

    promoted = RuntimeEngine.evaluate_eligibility(executions, templates)
    assert intake_run.id in promoted
    assert followup_run.state == "pending"

    RuntimeEngine.start(intake_run, now=_NOW)
    promoted = RuntimeEngine.complete(
        executions, templates, intake_run.id, result={}, now=_NOW
    )
    assert followup_run.id in promoted
    assert followup_run.state == "eligible"


# ---- Decision fan-out (XOR vs AND) --------------------------------------


def _decision_world() -> tuple[
    UUID, UUID, UUID, BlockExecution, BlockExecution, BlockExecution, dict[UUID, object]
]:
    decision_id = uuid4()
    high_id = uuid4()
    low_id = uuid4()
    decision = DecisionBlock(
        name="Risk?",
        question="Hoog risico?",
        outputs=("high", "low"),
        mode="xor",
    )
    high = TaskBlock(
        name="High path",
        title="High path",
        assignee="caregiver",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=decision_id,
                    args=DecisionOutputArgs(after_block=decision_id, output_key="high"),
                ),
            ],
        ),
    )
    low = TaskBlock(
        name="Low path",
        title="Low path",
        assignee="caregiver",
        input_logic=InputLogic(
            rules=[
                InputLogicRule(
                    node=decision_id,
                    args=DecisionOutputArgs(after_block=decision_id, output_key="low"),
                ),
            ],
        ),
    )
    decision_run = make_execution(decision_id, state="active")
    high_run = make_execution(high_id)
    low_run = make_execution(low_id)
    templates = {decision_id: decision, high_id: high, low_id: low}
    return decision_id, high_id, low_id, decision_run, high_run, low_run, templates


def test_decision_xor_skips_unselected_branch() -> None:
    (
        _decision_id,
        _high_id,
        _low_id,
        decision_run,
        high_run,
        low_run,
        templates,
    ) = _decision_world()
    executions = {decision_run.id: decision_run, high_run.id: high_run, low_run.id: low_run}
    promoted = RuntimeEngine.complete(
        executions,
        templates,  # type: ignore[arg-type]
        decision_run.id,
        result={"output_key": "high"},
        now=_NOW,
    )
    assert high_run.id in promoted
    assert high_run.state == "eligible"
    assert low_run.state == "skipped"


def test_decision_and_mode_does_not_auto_skip() -> None:
    (
        decision_id,
        high_id,
        low_id,
        decision_run,
        high_run,
        low_run,
        templates,
    ) = _decision_world()
    templates[decision_id].mode = "and"  # type: ignore[union-attr]
    executions = {decision_run.id: decision_run, high_run.id: high_run, low_run.id: low_run}
    promoted = RuntimeEngine.complete(
        executions,
        templates,  # type: ignore[arg-type]
        decision_run.id,
        result={"output_key": "high"},
        now=_NOW,
    )
    assert high_run.id in promoted
    assert high_run.state == "eligible"
    assert low_run.state == "pending"
    del decision_id, high_id, low_id
