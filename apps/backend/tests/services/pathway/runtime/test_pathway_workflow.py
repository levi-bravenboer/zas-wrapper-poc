"""End-to-end Temporal runtime tests via the time-skipping test server.

Proves the durable layer: `PathwayEnrollmentWorkflow` sleeps on a durable
timer until a time-gated auto block is due, fires it, auto-completes the
enrollment through `end_pathway`, and terminates the run with a cancel
Signal. The activities run against the real test DB (the same one the
service tests use), so the projection is asserted afterwards.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.contrib.pydantic import pydantic_data_converter
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from app.core.enums.patient import Gender, PatientSource
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.pathway import (
    PathwayBlock,
    PathwayEnrollment,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayVersion,
)
from app.db.models.pathway.pathway import Pathway
from app.domain.pathway.input_logic import IfDoneArgs, InputLogic, InputLogicRule
from app.repositories.pathway.enrollment_repository import EnrollmentRepository
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.pathway.enrollment import EnrollmentCreate
from app.services.pathway.enrollment_service import EnrollmentService
from app.temporal.activities import advance_runtime, cancel_runtime, complete_step
from app.temporal.types import EnrollmentWorkflowInput
from app.temporal.workflows import PathwayEnrollmentWorkflow
from scripts.seed_roles import ADMIN_ROLE_SLUG
from scripts.seed_users import (
    ADMIN_DISPLAY_NAME,
    ADMIN_EMAIL,
    ADMIN_USER_ID,
    admin_role_id,
)
from scripts.seed_tenant import ZAS_TENANT_ID
from tests._rbac import ALL_PERMISSIONS

_TASK_QUEUE = "test-pathway-runtime"


def _actor() -> SessionUser:
    return SessionUser(
        id=ADMIN_USER_ID,
        email=ADMIN_EMAIL,
        display_name=ADMIN_DISPLAY_NAME,
        tenant_id=ZAS_TENANT_ID,
        role_id=admin_role_id(ZAS_TENANT_ID),
        role_slug=ADMIN_ROLE_SLUG,
        permissions=ALL_PERMISSIONS,
    )


def _service(session: AsyncSession) -> EnrollmentService:
    return EnrollmentService(PathwayRepository(session), EnrollmentRepository(session))


async def _seed_message_then_end(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> dict[str, uuid.UUID]:
    """Seed a 2-block pathway: a `message` auto block → `end_pathway`."""
    del lane_kinds

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

    pathway = Pathway(name="Runtime", clinical_goal="Demo.", patient_goal="Demo.")
    db_session.add(pathway)
    await db_session.flush()

    version = PathwayVersion(pathway_id=pathway.id, version_no=1, status="concept", kind="initial")
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
            select(PathwayLaneKind.id).where(PathwayLaneKind.code == "caregiver")
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

    message_id = uuid.uuid4()
    end_id = uuid.uuid4()
    db_session.add(
        PathwayBlock(
            id=message_id,
            pathway_version_id=version.id,
            phase_id=phase.id,
            lane_id=lane.id,
            label="Notify",
            kind="message",
            message_channel="email",
            message_subject="Hi",
            message_body="Body",
        )
    )
    db_session.add(
        PathwayBlock(
            id=end_id,
            pathway_version_id=version.id,
            phase_id=phase.id,
            lane_id=lane.id,
            label="Einde",
            kind="end_pathway",
            input_logic=InputLogic(
                rules=[InputLogicRule(node=message_id, args=IfDoneArgs(after_block=message_id))],
            ).model_dump(mode="json"),
        )
    )
    await db_session.commit()
    return {"patient_id": patient.id, "version_id": version.id, "message_id": message_id}


async def _run_worker_and_start(env: WorkflowEnvironment, enrollment_id: uuid.UUID):
    handle = await env.client.start_workflow(
        PathwayEnrollmentWorkflow.run,
        EnrollmentWorkflowInput(enrollment_id=enrollment_id, actor=_actor()),
        id=f"enrollment-{enrollment_id}",
        task_queue=_TASK_QUEUE,
    )
    return handle


async def test_durable_timer_fires_auto_block_and_completes(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
    seeded_zas_users: list[object],
) -> None:
    del seeded_zas_users
    world = await _seed_message_then_end(db_session, lane_kinds)

    # Anchor in the future so the message is eligible-but-not-due at enroll;
    # the workflow must sleep on a durable timer until it falls due.
    anchor = date.today() + timedelta(days=3)
    enrollment = await _service(db_session).create(
        EnrollmentCreate(
            patient_id=world["patient_id"],
            pathway_version_id=world["version_id"],
            anchor_date=anchor,
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    async with await WorkflowEnvironment.start_time_skipping(
        data_converter=pydantic_data_converter
    ) as env:
        async with Worker(
            env.client,
            task_queue=_TASK_QUEUE,
            workflows=[PathwayEnrollmentWorkflow],
            activities=[advance_runtime, complete_step, cancel_runtime],
        ):
            handle = await _run_worker_and_start(env, enrollment.id)
            result = await handle.result()

    assert result == "completed"

    refreshed = (
        await db_session.execute(
            select(PathwayEnrollment).where(PathwayEnrollment.id == enrollment.id)
        )
    ).scalar_one()
    await db_session.refresh(refreshed)
    assert refreshed.state == "completed"


async def test_cancel_signal_terminates_enrollment(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
    seeded_zas_users: list[object],
) -> None:
    del seeded_zas_users
    world = await _seed_message_then_end(db_session, lane_kinds)

    # Far-future anchor → the message never falls due during the test, so the
    # workflow parks on its timer and we terminate it with a cancel Signal.
    anchor = date.today() + timedelta(days=3650)
    enrollment = await _service(db_session).create(
        EnrollmentCreate(
            patient_id=world["patient_id"],
            pathway_version_id=world["version_id"],
            anchor_date=anchor,
        ),
        tenant_id=ZAS_TENANT_ID,
    )
    await db_session.commit()

    async with await WorkflowEnvironment.start_time_skipping(
        data_converter=pydantic_data_converter
    ) as env:
        async with Worker(
            env.client,
            task_queue=_TASK_QUEUE,
            workflows=[PathwayEnrollmentWorkflow],
            activities=[advance_runtime, complete_step, cancel_runtime],
        ):
            handle = await _run_worker_and_start(env, enrollment.id)
            await handle.signal(PathwayEnrollmentWorkflow.cancel)
            result = await handle.result()

    assert result == "cancelled"

    refreshed = (
        await db_session.execute(
            select(PathwayEnrollment).where(PathwayEnrollment.id == enrollment.id)
        )
    ).scalar_one()
    await db_session.refresh(refreshed)
    assert refreshed.state == "cancelled"
