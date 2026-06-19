from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.care_team import RoleInCare
from app.core.enums.patient import Gender, PatientSource
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.services.care_team.care_team_service import CareTeamService
from tests._rbac import ensure_roles, make_session_user


async def _make_actor(session: AsyncSession, tenant: Tenant, email: str) -> User:
    actor_id = uuid.uuid4()
    roles = await ensure_roles(session, tenant.id)
    user = User(
        id=actor_id,
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        email=email,
        password_hash="hash",
        display_name=email,
        role_id=roles["default"].id,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _make_patient(
    session: AsyncSession, tenant: Tenant, org: Organisation, name: str
) -> Patient:
    patient = Patient(
        tenant_id=tenant.id,
        created_by=org.created_by,
        updated_by=org.created_by,
        primary_organisation_id=org.id,
        given_name=name,
        family_name=name,
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    session.add(patient)
    await session.flush()
    return patient


async def _make_team_with_member(
    session: AsyncSession,
    tenant: Tenant,
    patient: Patient,
    member: User,
    *,
    closed: bool = False,
) -> CareTeam:
    team = CareTeam(
        tenant_id=tenant.id,
        created_by=member.id,
        updated_by=member.id,
        patient_id=patient.id,
        name="T",
    )
    session.add(team)
    await session.flush()
    row = CareTeamParticipant(
        tenant_id=tenant.id,
        care_team_id=team.id,
        user_id=member.id,
        role_in_care=RoleInCare.PRIMARY,
        assigned_by=member.id,
    )
    if closed:
        row.period_end = datetime.now(UTC)
        row.unassigned_by = member.id
    session.add(row)
    await session.flush()
    return team


async def _setup(session: AsyncSession) -> tuple[Tenant, Organisation, User]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    admin_id = uuid.uuid4()
    roles = await ensure_roles(session, tenant.id)
    admin = User(
        id=admin_id,
        tenant_id=tenant.id,
        created_by=admin_id,
        updated_by=admin_id,
        email="admin@example.test",
        password_hash="hash",
        display_name="admin",
        role_id=roles["admin"].id,
        is_active=True,
    )
    session.add(admin)
    await session.flush()
    org = Organisation(
        tenant_id=tenant.id,
        created_by=admin.id,
        updated_by=admin.id,
        name="root",
        type_code="prov",
        parent_organisation_id=None,
    )
    session.add(org)
    await session.flush()
    return tenant, org, admin


async def test_visible_ids_returns_only_open_membership_patients(
    db_session: AsyncSession,
) -> None:
    tenant, org, _admin = await _setup(db_session)
    caregiver = await _make_actor(db_session, tenant, "c1@example.test")
    p_open = await _make_patient(db_session, tenant, org, "OpenMember")
    p_closed = await _make_patient(db_session, tenant, org, "ClosedMember")
    p_no_member = await _make_patient(db_session, tenant, org, "NoMember")
    await _make_team_with_member(db_session, tenant, p_open, caregiver)
    await _make_team_with_member(db_session, tenant, p_closed, caregiver, closed=True)
    await _make_patient(db_session, tenant, org, "Unrelated")

    service = CareTeamService(db_session)
    actor = make_session_user(
        id=caregiver.id,
        email=caregiver.email,
        display_name=caregiver.display_name,
        tenant_id=tenant.id,
        role_id=caregiver.role_id,
        permissions=frozenset(),
    )
    ids = await service.visible_patient_ids_for(actor)
    assert ids == {p_open.id}
    assert p_closed.id not in ids
    assert p_no_member.id not in ids


async def test_visible_ids_respects_tenant_isolation(db_session: AsyncSession) -> None:
    tenant_a, org_a, _ = await _setup(db_session)
    caregiver_a = await _make_actor(db_session, tenant_a, "ca@example.test")
    patient_a = await _make_patient(db_session, tenant_a, org_a, "A")
    await _make_team_with_member(db_session, tenant_a, patient_a, caregiver_a)

    # Second tenant with its own caregiver + open membership on a different patient.
    tenant_b = Tenant(id=uuid.uuid4(), slug="other", name="OTHER")
    db_session.add(tenant_b)
    await db_session.flush()
    admin_b_id = uuid.uuid4()
    roles_b = await ensure_roles(db_session, tenant_b.id)
    admin_b = User(
        id=admin_b_id,
        tenant_id=tenant_b.id,
        created_by=admin_b_id,
        updated_by=admin_b_id,
        email="ab@example.test",
        password_hash="hash",
        display_name="admin_b",
        role_id=roles_b["admin"].id,
        is_active=True,
    )
    db_session.add(admin_b)
    await db_session.flush()
    org_b = Organisation(
        tenant_id=tenant_b.id,
        created_by=admin_b.id,
        updated_by=admin_b.id,
        name="b_root",
        type_code="prov",
        parent_organisation_id=None,
    )
    db_session.add(org_b)
    await db_session.flush()
    patient_b = await _make_patient(db_session, tenant_b, org_b, "B")
    caregiver_b = await _make_actor(db_session, tenant_b, "cb@example.test")
    await _make_team_with_member(db_session, tenant_b, patient_b, caregiver_b)

    service = CareTeamService(db_session)
    actor_a = make_session_user(
        id=caregiver_a.id,
        email=caregiver_a.email,
        display_name=caregiver_a.display_name,
        tenant_id=tenant_a.id,
        role_id=caregiver_a.role_id,
        permissions=frozenset(),
    )
    ids = await service.visible_patient_ids_for(actor_a)
    assert ids == {patient_a.id}
    assert patient_b.id not in ids


async def test_has_open_membership_true_only_for_open_row(db_session: AsyncSession) -> None:
    tenant, org, _ = await _setup(db_session)
    caregiver = await _make_actor(db_session, tenant, "c@example.test")
    patient_open = await _make_patient(db_session, tenant, org, "O")
    patient_closed = await _make_patient(db_session, tenant, org, "C")
    await _make_team_with_member(db_session, tenant, patient_open, caregiver)
    await _make_team_with_member(db_session, tenant, patient_closed, caregiver, closed=True)

    service = CareTeamService(db_session)
    assert await service.has_open_membership(caregiver.id, patient_open.id) is True
    assert await service.has_open_membership(caregiver.id, patient_closed.id) is False
