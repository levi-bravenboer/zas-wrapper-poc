"""Mapper round-trip: domain BaseBlock ⇄ PathwayBlock-shaped row kwargs.

No DB hit. Uses a lightweight stand-in for `PathwayBlock` whose attribute
surface matches the columns the mapper reads. Covers every kind in the
chain-slot-#1 catalogue plus the legacy `(type, config)` fallback path.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.db.models.pathway.block_mapper import from_domain, to_domain
from app.domain.pathway.blocks.appointment.typed import AppointmentBlock
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.decision.typed import DecisionAutoResolve, DecisionBlock
from app.domain.pathway.blocks.form.typed import FormBlock, FormQuestion
from app.domain.pathway.blocks.luscii_program.typed import ExternalProgramBlock
from app.domain.pathway.blocks.message.typed import MessageBlock
from app.domain.pathway.blocks.milestone.typed import MilestoneBlock
from app.domain.pathway.blocks.pathway_link.typed import PathwayLinkBlock
from app.domain.pathway.blocks.task.typed import TaskBlock
from app.domain.pathway.blocks.wait.typed import WaitBlock


# Chain slot #2 §6 retired `legacy_to_domain` — the `(type, config)`
# fallback path is gone. The placeholder keeps the legacy
# `test_legacy_to_domain_*` test bodies parsable; they're skipped
# via decorators added below the test definitions.
def legacy_to_domain(*_args: object, **_kwargs: object) -> None:
    return None


@dataclass
class _Row:
    """Stand-in for `PathwayBlock` with all the column attributes the mapper
    reads. Default values mirror the SQL defaults from the alembic migration.
    """

    id: UUID = field(default_factory=uuid4)
    type: str = ""
    label: str | None = None
    config: dict[str, Any] = field(default_factory=dict)
    kind: str | None = None
    input_logic: list[dict[str, Any]] = field(default_factory=list)
    timing_policy: dict[str, Any] | None = None
    # Per-kind columns — all default None, mapper updates only the ones the
    # round-tripped subclass owns.
    appointment_title: str | None = None
    appointment_mode: str | None = None
    appointment_location: str | None = None
    appointment_duration_minutes: int | None = None
    appointment_attendees_patient: bool | None = None
    appointment_notes: str | None = None
    task_title: str | None = None
    task_assignee: str | None = None
    task_due_offset_days: int | None = None
    task_requires_completion: bool | None = None
    task_notes: str | None = None
    decision_question: str | None = None
    decision_auto_resolve: dict[str, Any] | None = None
    message_channel: str | None = None
    message_subject: str | None = None
    message_body: str | None = None
    message_cta_label: str | None = None
    message_cta_target: str | None = None
    form_title: str | None = None
    form_intro: str | None = None
    form_questions: list[dict[str, Any]] | None = None
    form_submit_label: str | None = None
    form_confirmation_message: str | None = None
    milestone_label: str | None = None
    milestone_description: str | None = None
    milestone_icon: str | None = None
    wait_event_type: str | None = None
    wait_source_block_id: UUID | None = None
    wait_timeout_days: int | None = None
    wait_on_timeout: str | None = None
    pathway_link_target_pathway_id: UUID | None = None
    pathway_link_mode: str | None = None
    pathway_link_version_pin: str | None = None
    pathway_link_pinned_version_id: UUID | None = None
    pathway_link_context_mapping: dict[str, str] | None = None
    external_program_provider: str | None = None
    external_program_program_id: str | None = None
    external_program_protocol_id: str | None = None
    external_program_mode: str | None = None


def _round_trip(block: BaseBlock) -> BaseBlock:
    """from_domain → apply kwargs to a fresh _Row → to_domain."""
    kwargs = from_domain(block)
    row = _Row()
    for key, value in kwargs.items():
        setattr(row, key, value)
    return to_domain(row)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "block",
    [
        AppointmentBlock(
            name="Intake",
            title="Intake afspraak",
            mode="in_person",
            location="Kamer 12",
            duration_minutes=30,
            attendees_patient=True,
            notes="Bring ID",
        ),
        TaskBlock(
            name="Bloed prikken",
            title="Bloed prikken",
            assignee="patient",
            due_offset_days=3,
            requires_completion=True,
            notes="Vroeg in de ochtend",
        ),
        DecisionBlock(
            name="Biopt?",
            question="Biopt nodig?",
            auto_resolve=DecisionAutoResolve(source_block_id=uuid4(), field_path="scan.result"),
        ),
        MessageBlock(
            name="Welkom",
            channel="email",
            subject="Welkom",
            body="Welkom in het traject",
            cta_label="Bekijk",
            cta_target="https://example.test/welcome",
        ),
        FormBlock(
            name="Intake formulier",
            title="Intake",
            intro="Vul in",
            questions=[
                FormQuestion(id="age", type="text", label="Leeftijd", required=True),
                FormQuestion(id="pain", type="scale", label="Pijn", required=False),
            ],
            submit_label="Verzenden",
            confirmation_message="Bedankt",
        ),
        MilestoneBlock(
            name="Operatie afgerond",
            label="Operatie afgerond",
            description="Mijlpaal na operatie",
            icon="flag",
        ),
        WaitBlock(
            name="Wacht op uitslag",
            event_type="form_completed",
            source_block_id=uuid4(),
            timeout_days=7,
            on_timeout="escalate",
        ),
        PathwayLinkBlock(
            name="Subpad",
            target_pathway_id=uuid4(),
            mode="blocking",
            version_pin="specific",
            pinned_version_id=uuid4(),
            context_mapping={"patient_id": "outer_patient_id"},
        ),
        ExternalProgramBlock(
            name="Luscii anesthesie",
            provider="luscii",
            program_id="luscii-anesthesia-v1",
            protocol_id="protocol-1",
            mode="blocking",
        ),
    ],
    ids=lambda b: type(b).__name__,
)
def test_round_trip_preserves_block(block: BaseBlock) -> None:
    restored = _round_trip(block)
    assert type(restored) is type(block)
    assert restored == block


@pytest.mark.skip(reason="legacy_to_domain retired in chain slot #2 §6")
def test_legacy_to_domain_appointment() -> None:
    row = _Row(
        type="appointment",
        label="Intake",
        config={"title": "Intake afspraak", "mode": "video", "duration_minutes": 15},
    )
    block = legacy_to_domain(row)  # type: ignore[arg-type]
    assert isinstance(block, AppointmentBlock)
    assert block.title == "Intake afspraak"
    assert block.mode == "video"
    assert block.duration_minutes == 15
    assert block.name == "Intake"


@pytest.mark.skip(reason="legacy_to_domain retired in chain slot #2 §6")
def test_legacy_to_domain_external_program_injects_provider() -> None:
    row = _Row(
        type="luscii.program",
        label="Luscii",
        config={"program_id": "p1", "protocol_id": "pr1", "mode": "blocking"},
    )
    block = legacy_to_domain(row)  # type: ignore[arg-type]
    assert isinstance(block, ExternalProgramBlock)
    assert block.provider == "luscii"
    assert block.program_id == "p1"


@pytest.mark.skip(reason="legacy_to_domain retired in chain slot #2 §6")
def test_to_domain_falls_back_to_legacy_when_kind_null() -> None:
    row = _Row(type="milestone", label="M1", config={"label": "Operatie", "icon": "flag"})
    block = to_domain(row)  # type: ignore[arg-type]
    assert isinstance(block, MilestoneBlock)
    assert block.label == "Operatie"


def test_from_domain_includes_discriminator() -> None:
    block = MilestoneBlock(name="M", label="Op")
    kwargs = from_domain(block)
    assert kwargs["kind"] == "milestone"
    assert kwargs["label"] == "M"
    assert kwargs["milestone_label"] == "Op"
