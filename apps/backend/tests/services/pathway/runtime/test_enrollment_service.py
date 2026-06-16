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
