from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.patient import Gender, PatientSource
from app.core.enums.user import Role
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser


@pytest.fixture
def session_actor() -> SessionUser | None:
    # Default to None — individual tests override below by setting the slot
    # directly so we can also test the unset path.
    return None


async def _bootstrap(session: AsyncSession) -> tuple[Tenant, User, Organisation]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor_id = uuid.uuid4()
    actor = User(
        id=actor_id,
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        email="a@example.test",
        password_hash="hash",
        display_name="a",
        role=Role.ADMIN,
        is_active=True,
    )
    session.add(actor)
    await session.flush()
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code="prov",
        parent_organisation_id=None,
    )
    session.add(org)
    await session.flush()
    return tenant, actor, org


async def test_audit_columns_stamped_when_actor_set(db_session: AsyncSession) -> None:
    tenant, actor, org = await _bootstrap(db_session)
    db_session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=actor.id,
        email=actor.email,
        display_name=actor.display_name,
        tenant_id=actor.tenant_id,
        role=actor.role,
    )
    patient = Patient(
        primary_organisation_id=org.id,
        given_name="Hook",
        family_name="Stamped",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    db_session.add(patient)
    await db_session.flush()

    assert patient.tenant_id == tenant.id
    assert patient.created_by == actor.id
    assert patient.updated_by == actor.id
