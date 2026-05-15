from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.patient import Gender, PatientSource
from app.core.enums.user import Role
from app.core.identifiers import INSZ_SYSTEM
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient, PatientIdentifier
from app.db.models.tenant import Tenant
from app.db.models.user import User


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


def _build_patient(tenant: Tenant, actor: User, org: Organisation, name: str) -> Patient:
    return Patient(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        primary_organisation_id=org.id,
        given_name=name,
        family_name=name,
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )


def _ident(actor: User, value: str) -> PatientIdentifier:
    return PatientIdentifier(
        system=INSZ_SYSTEM,
        value=value,
        created_by=actor.id,
        updated_by=actor.id,
    )


async def test_same_system_value_per_patient_collides(
    db_session: AsyncSession,
) -> None:
    tenant, actor, org = await _bootstrap(db_session)
    patient = _build_patient(tenant, actor, org, "A")
    patient.identifiers = [
        _ident(actor, "00000000196"),
        _ident(actor, "00000000196"),
    ]
    db_session.add(patient)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_same_value_across_patients_is_allowed(
    db_session: AsyncSession,
) -> None:
    tenant, actor, org = await _bootstrap(db_session)
    p1 = _build_patient(tenant, actor, org, "A")
    p1.identifiers = [_ident(actor, "00000000196")]
    p2 = _build_patient(tenant, actor, org, "B")
    p2.identifiers = [_ident(actor, "00000000196")]
    db_session.add_all([p1, p2])
    await db_session.flush()  # no IntegrityError
