"""Enrollment service DB integration tests (chain slot #3 §7.2)."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.patient import Gender, PatientSource
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.pathway import (
    Pathway,
    PathwayBlock,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayVersion,
)
from app.repositories.pathway.enrollment_repository import EnrollmentRepository
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.schemas.pathway.enrollment import (
    DeferredFieldValueIn,
    DeferredFieldValuePatch,
    EnrollmentCreate,
)
from app.services.pathway.enrollment_service import EnrollmentService
from app.services.pathway.errors import (
    CrossTenantReferenceError,
    DeferredFieldMissingError,
)
from scripts.seed_tenant import ZAS_TENANT_ID


@pytest.fixture
async def runtime_world(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> dict[str, object]:
    """Minimal pathway version + patient + org for runtime tests."""
    del lane_kinds  # ordering only

    org = Organisation(name="Demo Hospital", type_code="hospital")
    db_session.add(org)
    await db_session.flush()

    patient = Patient(
        primary_organisation_id=org.id,
        given_name="Test",
        family_name="Patient",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    db_session.add(patient)

    pathway = Pathway(
        name="Runtime test",
        clinical_goal="Demo runtime.",
        patient_goal="Demo runtime.",
    )
    db_session.add(pathway)
    await db_session.flush()

    # `published` status requires a `published_at` timestamp; for
    # the runtime tests we don't gate on publish state — enroll on a
    # concept version directly.
    version = PathwayVersion(
        pathway_id=pathway.id,
        version_no=1,
        status="concept",
        kind="initial",
    )
    db_session.add(version)
    await db_session.flush()

    phase = PathwayPhase(
        id=uuid.uuid4(),
        pathway_version_id=version.id,
        template_id="pre-op",
        label="Pre-op",
        ord=10,
        width_px=200,
    )
    db_session.add(phase)

    caregiver_lane_kind_id = (
        await db_session.execute(
            __import__("sqlalchemy")
            .select(PathwayLaneKind.id)
            .where(PathwayLaneKind.code == "caregiver")
        )
    ).scalar_one()
    lane = PathwayLane(
        id=uuid.uuid4(),
        pathway_version_id=version.id,
        pathway_lane_kind_id=caregiver_lane_kind_id,
        label="Caregiver",
        ord=10,
        is_default=True,
    )
    db_session.add(lane)
    await db_session.flush()

    intake_block = PathwayBlock(
        id=uuid.uuid4(),
        pathway_version_id=version.id,
        phase_id=phase.id,
        lane_id=lane.id,
        label="Intake",
        kind="appointment",
        appointment_title="Intake",
        appointment_mode="in_person",
    )
    db_session.add(intake_block)
    await db_session.commit()

    return {
        "patient": patient,
        "pathway": pathway,
        "version": version,
        "block": intake_block,
    }


def _service(db_session: AsyncSession) -> EnrollmentService:
    return EnrollmentService(
        PathwayRepository(db_session),
        EnrollmentRepository(db_session),
    )


# ---- Happy path -----------------------------------------------------------


async def test_create_enrollment_produces_executions(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]
    block = runtime_world["block"]

    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    assert view.state == "active"
    assert len(view.executions) == 1
    # Block has empty input_logic → initial eligibility promotes it.
    assert view.executions[0].block_template_id == block.id  # type: ignore[union-attr]
    assert view.executions[0].state == "eligible"


# ---- Missing deferred value ----------------------------------------------


async def test_create_rejects_missing_deferred_value(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    # Wire a DEFERRED_FIELDS-bearing block (AppointmentBlock declares
    # `location` as a non-required deferred field, so this test
    # exercises the path where nothing is required and create() should
    # succeed. We monkey-patch the catalogue to require `location` for
    # this assertion). Instead, validate via a synthetic required spec:
    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]
    block = runtime_world["block"]

    from app.domain.pathway.blocks.deferred import DeferredFieldSpec
    from app.domain.pathway.blocks.appointment.typed import AppointmentBlock

    original = AppointmentBlock.DEFERRED_FIELDS
    AppointmentBlock.DEFERRED_FIELDS = (  # type: ignore[misc]
        DeferredFieldSpec(
            attr="location",
            label="Locatie",
            kind="text",
            required=True,
        ),
    )
    try:
        with pytest.raises(DeferredFieldMissingError):
            await service.create(
                EnrollmentCreate(
                    patient_id=patient.id,  # type: ignore[union-attr]
                    pathway_version_id=version.id,  # type: ignore[union-attr]
                    anchor_date=date(2026, 6, 10),
                ),
                tenant_id=ZAS_TENANT_ID,
            )
        # Now supply the value and confirm create() succeeds.
        enrollment = await service.create(
            EnrollmentCreate(
                patient_id=patient.id,  # type: ignore[union-attr]
                pathway_version_id=version.id,  # type: ignore[union-attr]
                anchor_date=date(2026, 6, 10),
                deferred_values=[
                    DeferredFieldValueIn(
                        block_template_id=block.id,  # type: ignore[union-attr]
                        attr="location",
                        value_json="Room 12",
                    )
                ],
            ),
            tenant_id=ZAS_TENANT_ID,
        )
        await db_session.commit()
        view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
        assert len(view.deferred_values) == 1
    finally:
        AppointmentBlock.DEFERRED_FIELDS = original  # type: ignore[misc]


# ---- Cross-tenant guard ---------------------------------------------------


async def test_create_rejects_cross_tenant_patient(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]
    foreign_tenant = uuid.uuid4()
    with pytest.raises(CrossTenantReferenceError) as exc:
        await service.create(
            EnrollmentCreate(
                patient_id=patient.id,  # type: ignore[union-attr]
                pathway_version_id=version.id,  # type: ignore[union-attr]
                anchor_date=date(2026, 6, 10),
            ),
            tenant_id=foreign_tenant,
        )
    details = exc.value.details or {}
    assert details.get("field") == "patient_id"


# ---- patch_deferred_value re-runs eligibility ----------------------------


async def test_patch_deferred_value_creates_row(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]
    block = runtime_world["block"]

    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    before = datetime.now(UTC)
    row = await service.patch_deferred_value(
        enrollment.id,
        "location",
        DeferredFieldValuePatch(
            block_template_id=block.id,  # type: ignore[union-attr]
            value_json="Room 7",
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()
    assert row.value_json == "Room 7"
    assert row.set_at >= before


# ---- end_pathway auto-completes the enrollment ---------------------------


async def test_reachable_end_block_auto_completes_enrollment(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    """An `end_pathway` block with no upstream gate fires on enroll and
    flips the enrollment to `completed`."""
    version = runtime_world["version"]
    phase_id = runtime_world["block"].phase_id  # type: ignore[union-attr]
    lane_id = runtime_world["block"].lane_id  # type: ignore[union-attr]
    patient = runtime_world["patient"]

    end_block = PathwayBlock(
        id=uuid.uuid4(),
        pathway_version_id=version.id,  # type: ignore[union-attr]
        phase_id=phase_id,
        lane_id=lane_id,
        label="Einde",
        kind="end_pathway",
    )
    db_session.add(end_block)
    await db_session.commit()

    service = _service(db_session)
    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    assert view.state == "completed"
    end_exec = next(e for e in view.executions if e.block_template_id == end_block.id)
    assert end_exec.state == "completed"


# ---- relative_to_date clinical-date timers (§6.6) -------------------------


async def test_relative_to_date_timer_resolves_and_recomputes(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    version = runtime_world["version"]
    phase_id = runtime_world["block"].phase_id  # type: ignore[union-attr]
    lane_id = runtime_world["block"].lane_id  # type: ignore[union-attr]
    patient = runtime_world["patient"]

    pre_op = PathwayBlock(
        id=uuid.uuid4(),
        pathway_version_id=version.id,  # type: ignore[union-attr]
        phase_id=phase_id,
        lane_id=lane_id,
        label="Pre-op gesprek",
        kind="appointment",
        appointment_title="Pre-op",
        appointment_mode="in_person",
        timing_policy_kind="relative_to_date",
        timing_date_name="operation_date",
        timing_offset_iso="P2D",
        timing_direction="before",
    )
    db_session.add(pre_op)
    await db_session.commit()

    service = _service(db_session)
    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
            deferred_values=[
                DeferredFieldValueIn(
                    block_template_id=pre_op.id,
                    attr="operation_date",
                    value_json="2026-07-01",
                )
            ],
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    pre_op_exec = next(e for e in view.executions if e.block_template_id == pre_op.id)
    assert pre_op_exec.scheduled_at == datetime(2026, 6, 29, tzinfo=UTC)

    # Move the operation 1 month later → pre-op timer recomputes.
    await service.patch_deferred_value(
        enrollment.id,
        "operation_date",
        DeferredFieldValuePatch(block_template_id=pre_op.id, value_json="2026-08-01"),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    pre_op_exec = next(e for e in view.executions if e.block_template_id == pre_op.id)
    assert pre_op_exec.scheduled_at == datetime(2026, 7, 30, tzinfo=UTC)


# ---- audit trail on transitions (§3.7) -----------------------------------


async def test_transitions_emit_audit_events(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    from sqlalchemy import select as _select

    from app.core.enums.audit import AuditAction
    from app.db.models.audit.audit_event import AuditEvent

    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]

    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    rows = (
        (
            await db_session.execute(
                _select(AuditEvent).where(AuditEvent.resource_id == enrollment.id)
            )
        )
        .scalars()
        .all()
    )
    assert any(
        e.resource_type == "PathwayEnrollment" and e.action == AuditAction.CREATED for e in rows
    )


# ---- appointment materialization (§3.5) ----------------------------------


async def test_completing_appointment_step_materializes_appointment(
    db_session: AsyncSession,
    runtime_world: dict[str, object],
    seeded_zas_users: list[object],
) -> None:
    from datetime import UTC as _UTC
    from datetime import datetime as _dt

    from sqlalchemy import select as _select

    from app.core.enums.appointment import AppointmentStatus
    from app.core.enums.user import Role
    from app.db.models.appointment.appointment import Appointment
    from app.schemas.auth.auth import SessionUser
    from scripts.seed_users import ADMIN_DISPLAY_NAME, ADMIN_EMAIL, ADMIN_USER_ID

    del seeded_zas_users
    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]
    block = runtime_world["block"]  # appointment kind

    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    exec_id = next(e.id for e in view.executions if e.block_template_id == block.id)  # type: ignore[union-attr]

    actor = SessionUser(
        id=ADMIN_USER_ID,
        email=ADMIN_EMAIL,
        display_name=ADMIN_DISPLAY_NAME,
        tenant_id=ZAS_TENANT_ID,
        role=Role.ADMIN,
    )
    await service.complete_step(
        enrollment.id, exec_id, result=None, tenant_id=ZAS_TENANT_ID, now=_dt.now(_UTC)
    )
    await service.materialize_appointment(enrollment.id, exec_id, actor=actor)
    await db_session.commit()

    appt = (
        await db_session.execute(
            _select(Appointment).where(Appointment.pathway_block_instance_id == exec_id)
        )
    ).scalar_one()
    assert appt.patient_id == patient.id  # type: ignore[union-attr]
    assert appt.status == AppointmentStatus.FULFILLED


# ---- caregiver attribution on completion (§6.4) --------------------------


async def test_stamp_completion_records_caregiver(
    db_session: AsyncSession,
    runtime_world: dict[str, object],
    seeded_zas_users: list[object],
) -> None:
    from datetime import UTC as _UTC
    from datetime import datetime as _dt

    from app.core.enums.user import Role
    from app.schemas.auth.auth import SessionUser
    from scripts.seed_users import ADMIN_DISPLAY_NAME, ADMIN_EMAIL, ADMIN_USER_ID

    del seeded_zas_users
    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]
    block = runtime_world["block"]

    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()
    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    exec_id = next(e.id for e in view.executions if e.block_template_id == block.id)  # type: ignore[union-attr]

    actor = SessionUser(
        id=ADMIN_USER_ID,
        email=ADMIN_EMAIL,
        display_name=ADMIN_DISPLAY_NAME,
        tenant_id=ZAS_TENANT_ID,
        role=Role.ADMIN,
    )
    await service.complete_step(
        enrollment.id, exec_id, result=None, tenant_id=ZAS_TENANT_ID, now=_dt.now(_UTC)
    )
    await service.stamp_completion(enrollment.id, exec_id, actor=actor)
    await db_session.commit()

    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    completed = next(e for e in view.executions if e.id == exec_id)
    assert completed.completed_by_name == ADMIN_DISPLAY_NAME


# ---- participant resolution binds the appointment LEAD (§5.4) -------------


async def test_resolved_participant_becomes_appointment_lead(
    db_session: AsyncSession,
    runtime_world: dict[str, object],
    seeded_zas_users: list[object],
) -> None:
    from datetime import UTC as _UTC
    from datetime import datetime as _dt

    from sqlalchemy import select as _select

    from app.core.enums.user import Role
    from app.db.models.appointment.appointment import Appointment
    from app.db.models.appointment.appointment_participant import AppointmentParticipant
    from app.schemas.auth.auth import SessionUser
    from app.schemas.pathway.enrollment import EnrollmentParticipantIn
    from scripts.seed_users import (
        ADMIN_DISPLAY_NAME,
        ADMIN_EMAIL,
        ADMIN_USER_ID,
        CAREGIVER_EMAIL,
    )

    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)  # type: ignore[attr-defined]
    service = _service(db_session)
    patient = runtime_world["patient"]
    version = runtime_world["version"]
    block = runtime_world["block"]  # appointment

    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date(2026, 6, 10),
            participants=[
                EnrollmentParticipantIn(
                    block_template_id=block.id,  # type: ignore[union-attr]
                    user_id=caregiver.id,
                    role="arts",
                )
            ],
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()
    view = await service.get_view(enrollment.id, tenant_id=ZAS_TENANT_ID)
    exec_id = next(e.id for e in view.executions if e.block_template_id == block.id)  # type: ignore[union-attr]

    actor = SessionUser(
        id=ADMIN_USER_ID,
        email=ADMIN_EMAIL,
        display_name=ADMIN_DISPLAY_NAME,
        tenant_id=ZAS_TENANT_ID,
        role=Role.ADMIN,
    )
    await service.complete_step(
        enrollment.id, exec_id, result=None, tenant_id=ZAS_TENANT_ID, now=_dt.now(_UTC)
    )
    await service.materialize_appointment(enrollment.id, exec_id, actor=actor)
    await db_session.commit()

    appt_id = (
        await db_session.execute(
            _select(Appointment.id).where(Appointment.pathway_block_instance_id == exec_id)
        )
    ).scalar_one()
    lead = (
        await db_session.execute(
            _select(AppointmentParticipant.user_id).where(
                AppointmentParticipant.appointment_id == appt_id
            )
        )
    ).scalar_one()
    # The bound caregiver, not the completing admin actor.
    assert lead == caregiver.id


# ---- descriptor surfaces named clinical dates (§5.5) ---------------------


async def test_enroll_descriptor_lists_clinical_dates(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    version = runtime_world["version"]
    phase_id = runtime_world["block"].phase_id  # type: ignore[union-attr]
    lane_id = runtime_world["block"].lane_id  # type: ignore[union-attr]

    db_session.add(
        PathwayBlock(
            id=uuid.uuid4(),
            pathway_version_id=version.id,  # type: ignore[union-attr]
            phase_id=phase_id,
            lane_id=lane_id,
            label="Pre-op",
            kind="appointment",
            appointment_title="Pre-op",
            appointment_mode="in_person",
            timing_policy_kind="relative_to_date",
            timing_date_name="operation_date",
            timing_offset_iso="P2D",
            timing_direction="before",
        )
    )
    await db_session.commit()

    descriptor = await _service(db_session).enroll_descriptor(
        version.id,  # type: ignore[union-attr]
        tenant_id=ZAS_TENANT_ID,
    )
    op_date = next(c for c in descriptor.clinical_dates if c.name == "operation_date")
    assert op_date.earliest_offset_days == 2


# ---- SLA timer: advance wakes at a future due_at (§3.9) ------------------


async def test_advance_wakes_at_future_due_at(
    db_session: AsyncSession, runtime_world: dict[str, object]
) -> None:
    from datetime import UTC as _UTC
    from datetime import datetime as _dt

    version = runtime_world["version"]
    phase_id = runtime_world["block"].phase_id  # type: ignore[union-attr]
    lane_id = runtime_world["block"].lane_id  # type: ignore[union-attr]
    patient = runtime_world["patient"]

    db_session.add(
        PathwayBlock(
            id=uuid.uuid4(),
            pathway_version_id=version.id,  # type: ignore[union-attr]
            phase_id=phase_id,
            lane_id=lane_id,
            label="SLA task",
            kind="task",
            task_title="Within window",
            task_assignee="caregiver",
            timing_policy_kind="due_within",
            timing_window_iso="P7D",
        )
    )
    await db_session.commit()

    service = _service(db_session)
    enrollment = await service.create(
        EnrollmentCreate(
            patient_id=patient.id,  # type: ignore[union-attr]
            pathway_version_id=version.id,  # type: ignore[union-attr]
            anchor_date=date.today(),
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    tick = await service.advance(enrollment.id, tenant_id=ZAS_TENANT_ID, now=_dt.now(_UTC))
    assert tick.next_wake_at is not None
