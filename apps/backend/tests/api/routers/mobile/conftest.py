from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.patient import Patient
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.access.identity.password import PasswordHasher
from scripts.seed_organisations import seed_organisations
from scripts.seed_patients import seed_patients
from scripts.seed_tenant import seed_zas_tenant
from scripts.seed_users import ADMIN_EMAIL, seed_users
from tests._rbac import ensure_roles, make_session_user

PATIENT_PASSWORD = "patient-pass"
PATIENT_EMAIL = "patient@zas.local"


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe tenant-scoped tables around every mobile-auth router test."""


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@dataclass(frozen=True)
class SeededPatientLogin:
    patient: Patient
    user: User


@pytest.fixture
async def seeded_zas_patient_user(db_session: AsyncSession) -> SeededPatientLogin:
    """Seed tenant + admin/caregiver + orgs + one patient + patient user.

    The patient user references the first seeded patient via
    `users.patient_id`. Password hash is derived from `PATIENT_PASSWORD`.
    """

    await seed_zas_tenant(db_session)
    await db_session.commit()
    users = await seed_users(db_session)
    await db_session.commit()
    await seed_organisations(db_session)
    await db_session.commit()
    patients = await seed_patients(db_session)
    await db_session.commit()

    admin = next(u for u in users if u.email == ADMIN_EMAIL)
    patient = patients[0]
    roles = await ensure_roles(db_session, patient.tenant_id)

    repo = UserRepository(db_session)
    hasher = PasswordHasher()
    db_session.info[SESSION_ACTOR_KEY] = make_session_user(
        tenant_id=admin.tenant_id,
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        admin=True,
        role_id=admin.role_id,
    )
    try:
        patient_user = User(
            tenant_id=patient.tenant_id,
            email=PATIENT_EMAIL,
            password_hash=hasher.hash(PATIENT_PASSWORD),
            display_name=f"{patient.given_name} {patient.family_name}",
            role_id=roles["default"].id,
            is_active=True,
            patient_id=patient.id,
        )
        await repo.add(patient_user)
        await db_session.commit()
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)

    return SeededPatientLogin(patient=patient, user=patient_user)
