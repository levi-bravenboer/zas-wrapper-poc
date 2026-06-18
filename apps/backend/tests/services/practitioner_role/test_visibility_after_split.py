from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.patient import Gender, PatientSource
from app.core.enums.practitioner_role import PractitionerRoleCode
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.services.practitioner_role.predicates import (
    patient_ids_under_roots,
    practitioner_root_orgs_for,
)
from tests._rbac import ensure_roles, make_session_user


async def _bootstrap(
    session: AsyncSession,
) -> tuple[Tenant, User, list[Organisation]]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor_id = uuid.uuid4()
    roles = await ensure_roles(session, tenant.id)
    actor = User(
        id=actor_id,
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        email="c@example.test",
        password_hash="hash",
        display_name="c",
        role_id=roles["default"].id,
        is_active=True,
    )
    session.add(actor)
    await session.flush()
    root = Organisation(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code="prov",
        parent_organisation_id=None,
    )
    session.add(root)
    await session.flush()
    dept = Organisation(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="dept",
        type_code="dept",
        parent_organisation_id=root.id,
    )
    session.add(dept)
    await session.flush()
    team = Organisation(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="team",
        type_code="team",
        parent_organisation_id=dept.id,
    )
    session.add(team)
    await session.flush()
    return tenant, actor, [root, dept, team]


async def _make_practitioner(session: AsyncSession, tenant: Tenant, user: User) -> Practitioner:
    practitioner = Practitioner(
        tenant_id=tenant.id,
        created_by=user.id,
        updated_by=user.id,
        user_id=user.id,
        given_name="C",
        family_name="C",
    )
    session.add(practitioner)
    await session.flush()
    return practitioner


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


async def test_root_orgs_returns_root_for_open_role(db_session: AsyncSession) -> None:
    tenant, user, orgs = await _bootstrap(db_session)
    root, _dept, team = orgs
    practitioner = await _make_practitioner(db_session, tenant, user)
    db_session.add(
        PractitionerRole(
            tenant_id=tenant.id,
            created_by=user.id,
            updated_by=user.id,
            practitioner_id=practitioner.id,
            organisation_id=team.id,
            code=PractitionerRoleCode.NURSE,
            is_primary=True,
        )
    )
    await db_session.flush()
    actor = make_session_user(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=tenant.id,
        role_id=user.role_id,
        permissions=frozenset(),
    )
    roots = await practitioner_root_orgs_for(db_session, actor)
    assert roots == {root.id}


async def test_root_orgs_empty_when_no_open_role(db_session: AsyncSession) -> None:
    tenant, user, _ = await _bootstrap(db_session)
    actor = make_session_user(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=tenant.id,
        role_id=user.role_id,
        permissions=frozenset(),
    )
    roots = await practitioner_root_orgs_for(db_session, actor)
    assert roots == set()


async def test_patient_ids_under_roots_walks_descendants(
    db_session: AsyncSession,
) -> None:
    tenant, _user, orgs = await _bootstrap(db_session)
    root, dept, team = orgs
    p_root = await _make_patient(db_session, tenant, root, "PR")
    p_dept = await _make_patient(db_session, tenant, dept, "PD")
    p_team = await _make_patient(db_session, tenant, team, "PT")

    ids = await patient_ids_under_roots(db_session, tenant.id, {root.id})
    assert ids == {p_root.id, p_dept.id, p_team.id}


async def test_patient_ids_under_roots_excludes_other_root(
    db_session: AsyncSession,
) -> None:
    tenant, user, orgs = await _bootstrap(db_session)
    _root, _dept, team = orgs
    other_root = Organisation(
        tenant_id=tenant.id,
        created_by=user.id,
        updated_by=user.id,
        name="other",
        type_code="prov",
        parent_organisation_id=None,
    )
    db_session.add(other_root)
    await db_session.flush()
    p_other = await _make_patient(db_session, tenant, other_root, "PO")
    await _make_patient(db_session, tenant, team, "PT")

    ids = await patient_ids_under_roots(db_session, tenant.id, {other_root.id})
    assert ids == {p_other.id}
