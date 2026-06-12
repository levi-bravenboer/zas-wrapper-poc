"""Smoke tests for the typed `BaseBlock` subclass hierarchy.

The legacy `BlockTypeEntry` registry has its own coverage in
`test_blocks.py`; this file guards the new class shape introduced by
chain slot #1 (`pathway-model-foundations`).
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.domain.pathway.blocks.appointment.typed import AppointmentBlock
from app.domain.pathway.blocks.base import BaseBlock, UnknownBlockKindError
from app.domain.pathway.blocks.decision.typed import DecisionBlock
from app.domain.pathway.blocks.form.typed import FormBlock, FormQuestion
from app.domain.pathway.blocks.luscii_program.typed import ExternalProgramBlock
from app.domain.pathway.blocks.message.typed import MessageBlock
from app.domain.pathway.blocks.milestone.typed import MilestoneBlock
from app.domain.pathway.blocks.pathway_link.typed import PathwayLinkBlock
from app.domain.pathway.blocks.resolver import BLOCK_CLASSES, resolve_block_kind
from app.domain.pathway.blocks.task.typed import TaskBlock
from app.domain.pathway.blocks.treatment.typed import TreatmentBlock, TreatmentResult
from app.domain.pathway.blocks.wait.typed import WaitBlock
from app.domain.pathway.lanes import (
    LANE_KIND_CAREGIVER,
    LANE_KIND_EXTERNAL,
    LANE_KIND_PATIENT,
    LANE_KIND_SYSTEM,
)


def test_every_subclass_declares_unique_kind() -> None:
    kinds = [cls.KIND for cls in BLOCK_CLASSES]
    assert len(kinds) == len(set(kinds)), f"duplicate KIND across subclasses: {kinds}"
    assert all(k for k in kinds), "every subclass must set a non-empty KIND"


def test_subclass_missing_kind_raises() -> None:
    with pytest.raises(TypeError, match="non-empty `KIND`"):

        class NoKindBlock(BaseBlock):  # type: ignore[misc]
            pass


def test_resolver_maps_current_kinds() -> None:
    for cls in BLOCK_CLASSES:
        assert resolve_block_kind(cls.KIND) is cls


def test_resolver_maps_legacy_dotted_type() -> None:
    assert resolve_block_kind("luscii.program") is ExternalProgramBlock


def test_resolver_rejects_unknown() -> None:
    with pytest.raises(UnknownBlockKindError):
        resolve_block_kind("does-not-exist")


def test_appointment_block_instantiates_with_minimal_fields() -> None:
    block = AppointmentBlock(name="Intake", title="Intake afspraak")
    assert block.KIND == "appointment"
    assert block.title == "Intake afspraak"
    assert LANE_KIND_CAREGIVER in AppointmentBlock.allowed_lane_kinds


def test_treatment_block_instantiates_with_minimal_fields() -> None:
    block = TreatmentBlock(name="Operatie", title="Lumbale spinale fusie")
    assert block.KIND == "treatment"
    assert block.TYPE_CODE == "treatment"
    assert block.title == "Lumbale spinale fusie"
    assert TreatmentBlock.allowed_lane_kinds == (LANE_KIND_CAREGIVER,)
    assert TreatmentBlock.RESULT_TYPE is TreatmentResult


def test_treatment_block_optional_fields_default_none() -> None:
    block = TreatmentBlock(name="Operatie", title="Operatie")
    assert block.location is None
    assert block.duration_minutes is None
    assert block.treatment_notes is None


def test_treatment_block_rejects_missing_title() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TreatmentBlock(name="Operatie")  # type: ignore[call-arg]


def test_treatment_result_round_trip() -> None:
    from datetime import UTC, datetime

    result = TreatmentResult(
        performed_at=datetime(2026, 6, 12, 10, 30, tzinfo=UTC),
        notes="ongecompliceerd",
        complications=None,
    )
    payload = result.model_dump(mode="json")
    assert payload["notes"] == "ongecompliceerd"
    parsed = TreatmentResult.model_validate(payload)
    assert parsed.performed_at == result.performed_at


def test_task_block_requires_assignee() -> None:
    block = TaskBlock(name="Bloed prikken", title="Bloed prikken", assignee="patient")
    assert block.assignee == "patient"
    assert set(TaskBlock.allowed_lane_kinds) == {LANE_KIND_PATIENT, LANE_KIND_CAREGIVER}


def test_decision_block_supports_branches() -> None:
    block = DecisionBlock(name="Biopt?", question="Biopt nodig?")
    assert block.SUPPORTS_BRANCHES is True
    assert DecisionBlock.allowed_lane_kinds == (LANE_KIND_SYSTEM,)


def test_message_block_channel_required() -> None:
    block = MessageBlock(
        name="Welkom",
        channel="email",
        subject="Welkom",
        body="Welkom in het traject",
    )
    assert block.channel == "email"


def test_form_block_requires_at_least_one_question() -> None:
    block = FormBlock(
        name="Intake formulier",
        title="Intake",
        questions=[FormQuestion(id="age", type="text", label="Leeftijd", required=True)],
    )
    assert len(block.questions) == 1


def test_milestone_block_minimal() -> None:
    block = MilestoneBlock(name="Operatie afgerond", label="Operatie afgerond")
    assert block.label == "Operatie afgerond"


def test_wait_block_event_type() -> None:
    block = WaitBlock(name="Wacht op uitslag", event_type="form_completed")
    assert block.event_type == "form_completed"


def test_pathway_link_specific_requires_pinned_version() -> None:
    target = uuid4()
    # latest_published: no pinned id needed
    PathwayLinkBlock(
        name="Subpad",
        target_pathway_id=target,
        mode="blocking",
        version_pin="latest_published",
    )
    # specific without pinned id -> rejected
    with pytest.raises(ValueError, match="pinned_version_id"):
        PathwayLinkBlock(
            name="Subpad",
            target_pathway_id=target,
            mode="blocking",
            version_pin="specific",
        )


def test_external_program_block_provider() -> None:
    block = ExternalProgramBlock(name="Luscii anesthesie", provider="luscii")
    assert block.provider == "luscii"
    assert ExternalProgramBlock.allowed_lane_kinds == (LANE_KIND_EXTERNAL,)
