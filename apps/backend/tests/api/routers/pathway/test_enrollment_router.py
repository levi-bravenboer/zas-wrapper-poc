"""Router-level auth tests for `/enrollments` (chain slot #3 §5).

Targets the Keto-graduated + carepath-scoped guards added in
`enrollment_router._require_enrollment_access` and the inline auth
pair on `create_enrollment`. Service-edge logic is covered separately
in `tests/services/pathway/runtime/test_enrollment_service.py`; the
tests here exercise the HTTP surface so a refactor that widens access
would surface as a CI failure rather than silently shipping.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.patient import Gender, PatientSource
from app.core.enums.user import Role
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.pathway import (
    PathwayBlock,
    PathwayBlockExecution,
    PathwayDeferredFieldValue,
    PathwayEnrollment,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayVersion,
)
from app.db.models.pathway.pathway import Pathway
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from scripts.seed_tenant import ZAS_TENANT_ID
from scripts.seed_users import (
    ADMIN_DISPLAY_NAME,
    ADMIN_EMAIL,
    ADMIN_USER_ID,
)

_PASSWORD = "changeme"

# Used to seed cross-tenant patients / pathways for the boundary tests.
_OTHER_TENANT_ID = uuid.UUID("00000000-0000-4000-8000-000000000bb1")


@pytest.fixture
def session_actor() -> SessionUser:
    """Stamp seeded rows with the ZAS admin actor.

    Mirrors the override in `tests/services/pathway/conftest.py` so the
    audit hook fills `tenant_id` / `created_by` / `updated_by` for the
    in-test SA inserts without each row passing them explicitly.
    """

    return SessionUser(
        id=ADMIN_USER_ID,
        email=ADMIN_EMAIL,
        display_name=ADMIN_DISPLAY_NAME,
        tenant_id=ZAS_TENANT_ID,
        role=Role.ADMIN,
    )


@pytest.fixture(autouse=True)
async def _autoclean_runtime_tables(
    db_session: AsyncSession,
) -> AsyncIterator[None]:
    """Wipe runtime + patient/org tables.

    Sibling pathway conftest's `_autoclean_pathway_tables` wipes
    Pathway/LaneKind/User/Tenant; this fixture clears the runtime
    aggregate + patient/org rows the enrollment surface adds. Both
    fixtures are autouse and pytest does not guarantee an explicit
    ordering between them — relying on alphabetical
    (`_autoclean_pathway_tables` < `_autoclean_runtime_tables`) is
    fragile. We make the order explicit by wiping the FK-leaf tables
    here (the ones with RESTRICT FKs back to pathway/tenant rows), so
    sibling's wipe of the parent tables cannot fail regardless of
    fixture order.
    """

    await _wipe(db_session)
    yield
    await _wipe(db_session)


async def _wipe(session: AsyncSession) -> None:
    for model in (
        PathwayDeferredFieldValue,
        PathwayBlockExecution,
        PathwayEnrollment,
        Patient,
        Organisation,
    ):
        await session.execute(delete(model))
    await session.commit()


def _stamp(row: object, tenant_id: uuid.UUID | None) -> None:
    """Force-set audit columns for cross-tenant seeding.

    The `session_actor` fixture stamps via the audit hook when a row's
    `tenant_id` is left unset, which works for own-tenant seeding. For
    cross-tenant boundary tests the helper passes an explicit tenant
    so the audit hook no-ops; we mirror `created_by` / `updated_by`
    here so the rows pass FK + NOT NULL constraints.
    """

    if tenant_id is None:
        return
    row.tenant_id = tenant_id  # type: ignore[attr-defined]
    row.created_by = ADMIN_USER_ID  # type: ignore[attr-defined]
    row.updated_by = ADMIN_USER_ID  # type: ignore[attr-defined]


async def _login(client: AsyncClient) -> None:
    response = await client.post(
        "/auth/login/password",
        json={"email": ADMIN_EMAIL, "password": _PASSWORD},
    )
    assert response.status_code == 200, response.text


async def _seed_world(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
    *,
    tenant_id: uuid.UUID | None = None,
) -> dict[str, uuid.UUID]:
    """Seed minimal {patient, pathway version, block} for a tenant.

    `tenant_id=None` stamps via the autouse `session_actor` (ZAS admin);
    passing an explicit `tenant_id` forces the row's audit columns so the
    cross-tenant boundary tests can seed a foreign patient / pathway.
    """

    del lane_kinds

    if tenant_id is not None:
        # Foreign tenant must exist before the FK-bearing rows below can
        # land. Idempotent insert so multiple `_seed_world(tenant_id=...)`
        # calls in the same test still work.
        await db_session.execute(
            pg_insert(Tenant)
            .values(id=tenant_id, slug=f"foreign-{tenant_id.hex[:8]}", name="Foreign")
            .on_conflict_do_nothing(index_elements=[Tenant.id])
        )
        await db_session.flush()

    org = Organisation(name="Demo Hospital", type_code="hospital")
    _stamp(org, tenant_id)
    db_session.add(org)
    await db_session.flush()

    patient = Patient(
        primary_organisation_id=org.id,
        given_name="Test",
        family_name="Patient",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    _stamp(patient, tenant_id)
    db_session.add(patient)

    pathway = Pathway(
        name="Runtime test",
        clinical_goal="Demo runtime.",
        patient_goal="Demo runtime.",
    )
    _stamp(pathway, tenant_id)
    db_session.add(pathway)
    await db_session.flush()

    version = PathwayVersion(
        pathway_id=pathway.id,
        version_no=1,
        status="concept",
        kind="initial",
    )
    _stamp(version, tenant_id)
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
    _stamp(phase, tenant_id)
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
    _stamp(lane, tenant_id)
    db_session.add(lane)
    await db_session.flush()

    block = PathwayBlock(
        id=uuid.uuid4(),
        pathway_version_id=version.id,
        phase_id=phase.id,
        lane_id=lane.id,
        label="Intake",
        kind="appointment",
        appointment_title="Intake",
        appointment_mode="in_person",
    )
    _stamp(block, tenant_id)
    db_session.add(block)
    await db_session.commit()

    return {
        "patient_id": patient.id,
        "pathway_id": pathway.id,
        "version_id": version.id,
        "block_id": block.id,
    }


# ---- Tests ----------------------------------------------------------------


async def test_endpoints_require_auth(async_client: AsyncClient) -> None:
    enrollment_id = uuid.uuid4()
    execution_id = uuid.uuid4()
    routes = [
        (
            "POST",
            "/enrollments",
            {
                "patient_id": str(uuid.uuid4()),
                "pathway_version_id": str(uuid.uuid4()),
                "anchor_date": "2026-06-10",
            },
        ),
        ("GET", f"/enrollments/{enrollment_id}", None),
        ("POST", f"/enrollments/{enrollment_id}/executions/{execution_id}:start", None),
        (
            "POST",
            f"/enrollments/{enrollment_id}/executions/{execution_id}:complete",
            {"result": None},
        ),
        (
            "PATCH",
            f"/enrollments/{enrollment_id}/deferred-values/location",
            {"block_template_id": str(uuid.uuid4()), "value_json": "Room 7"},
        ),
    ]
    for method, path, body in routes:
        response = await async_client.request(method, path, json=body)
        assert response.status_code == 401, f"{method} {path}: {response.status_code}"


async def test_create_enrollment_happy_path(
    async_client: AsyncClient,
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    world = await _seed_world(db_session, lane_kinds)
    await _login(async_client)

    response = await async_client.post(
        "/enrollments",
        json={
            "patient_id": str(world["patient_id"]),
            "pathway_version_id": str(world["version_id"]),
            "anchor_date": "2026-06-10",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["patient_id"] == str(world["patient_id"])
    assert body["pathway_version_id"] == str(world["version_id"])


async def test_list_enrollments_by_patient(
    async_client: AsyncClient,
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    world = await _seed_world(db_session, lane_kinds)
    await _login(async_client)
    created = await async_client.post(
        "/enrollments",
        json={
            "patient_id": str(world["patient_id"]),
            "pathway_version_id": str(world["version_id"]),
            "anchor_date": "2026-06-10",
        },
    )
    assert created.status_code == 201, created.text

    response = await async_client.get(
        "/enrollments",
        params={"patient_id": str(world["patient_id"])},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["patient_id"] == str(world["patient_id"])
    assert body[0]["pathway_id"] == str(world["pathway_id"])
    assert body[0]["pathway_version_id"] == str(world["version_id"])
    assert len(body[0]["executions"]) >= 1


async def test_cancel_enrollment(
    async_client: AsyncClient,
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    world = await _seed_world(db_session, lane_kinds)
    await _login(async_client)
    created = await async_client.post(
        "/enrollments",
        json={
            "patient_id": str(world["patient_id"]),
            "pathway_version_id": str(world["version_id"]),
            "anchor_date": "2026-06-10",
        },
    )
    assert created.status_code == 201, created.text
    enrollment_id = created.json()["id"]

    response = await async_client.post(f"/enrollments/{enrollment_id}:cancel")
    assert response.status_code == 200, response.text
    assert response.json()["state"] == "cancelled"

    # Idempotent: cancelling again leaves it cancelled.
    again = await async_client.post(f"/enrollments/{enrollment_id}:cancel")
    assert again.status_code == 200, again.text
    assert again.json()["state"] == "cancelled"


async def test_get_unknown_enrollment_returns_404(
    async_client: AsyncClient,
    seeded_zas_users: list[User],
) -> None:
    # Test never queries lanes, so the fixture dep is on `seeded_zas_users`
    # directly — needed so `_login` finds the bootstrap admin user.
    del seeded_zas_users
    await _login(async_client)
    response = await async_client.get(f"/enrollments/{uuid.uuid4()}")
    assert response.status_code == 404, response.text


async def test_create_rejects_cross_tenant_patient(
    async_client: AsyncClient,
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    """Patient in a different tenant must surface as 404.

    `resolve_patient_with_relation` looks the patient up via
    `PatientService.get_by_id(tenant_id=current_user.tenant_id, ...)`;
    a foreign-tenant patient is invisible and the helper raises
    `PatientNotFoundError`.
    """

    foreign_world = await _seed_world(db_session, lane_kinds, tenant_id=_OTHER_TENANT_ID)
    own_world = await _seed_world(db_session, lane_kinds)
    await _login(async_client)
    response = await async_client.post(
        "/enrollments",
        json={
            "patient_id": str(foreign_world["patient_id"]),
            "pathway_version_id": str(own_world["version_id"]),
            "anchor_date": "2026-06-10",
        },
    )
    assert response.status_code == 404, response.text


async def test_create_rejects_cross_tenant_pathway_version(
    async_client: AsyncClient,
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    """Pathway version in a different tenant surfaces as 422.

    The router-level carepath guard does not enforce tenant boundaries
    (Keto's `Carepath` namespace answers caregiver scope only), so the
    service-edge `_assert_pathway_version_in_tenant` defence-in-depth
    is what catches this — `CrossTenantReferenceError` -> 422.
    """

    foreign_world = await _seed_world(db_session, lane_kinds, tenant_id=_OTHER_TENANT_ID)
    own_world = await _seed_world(db_session, lane_kinds)
    await _login(async_client)
    response = await async_client.post(
        "/enrollments",
        json={
            "patient_id": str(own_world["patient_id"]),
            "pathway_version_id": str(foreign_world["version_id"]),
            "anchor_date": date(2026, 6, 10).isoformat(),
        },
    )
    assert response.status_code == 422, response.text
