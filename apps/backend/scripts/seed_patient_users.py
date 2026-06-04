"""Idempotent seed of demo patient user(s) linked to seeded patients.

Must run AFTER seed_patients (patient rows must exist) and seed_users
(admin actor required for the audit hook).

Run: `python -m scripts.seed_patient_users` (or via `seed_all`).
"""

from __future__ import annotations

import logging
import os
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.patient import Patient
from app.db.models.user import User
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.auth.password import PasswordHasher
from scripts._db import run_script
from scripts.seed_patients import SEED_EXTERNAL_SYSTEM
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_USER_ID

logger = logging.getLogger(__name__)

PATIENT_PASSWORD_ENV = "BACKEND_BOOTSTRAP_PATIENT_PASSWORD"
PATIENT_EMAIL = "patient@zas.local"
_PASSWORD_FALLBACK = "changeme"


async def seed_patient_users(session: AsyncSession) -> list[User]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        logger.error("cannot seed patient users: %s tenant missing", ZAS_TENANT_SLUG)
        raise RuntimeError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    raw_password = os.getenv(PATIENT_PASSWORD_ENV)
    if raw_password is None:
        logger.warning(
            "bootstrap password env var %s unset, using %r fallback",
            PATIENT_PASSWORD_ENV,
            _PASSWORD_FALLBACK,
        )
        raw_password = _PASSWORD_FALLBACK

    hasher = PasswordHasher()
    user_repo = UserRepository(session)

    # Look up the admin actor for audit-hook stamping.
    admin = await user_repo.get_by_id(ADMIN_USER_ID)
    if admin is None:
        logger.error("cannot seed patient users: admin user missing — run seed_users first")
        raise RuntimeError("admin user missing — run seed_users first")

    session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        tenant_id=admin.tenant_id,
        role=admin.role,
    )

    # Pick the first seeded patient (deterministic by external_ref).
    patient = (
        await session.execute(
            select(Patient).where(
                Patient.tenant_id == tenant.id,
                Patient.external_system == SEED_EXTERNAL_SYSTEM,
                Patient.external_ref == "seed:patient:01",
                Patient.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if patient is None:
        logger.error(
            "cannot seed patient users: no seeded patients found — run seed_patients first"
        )
        raise RuntimeError("seeded patient not found — run seed_patients first")

    # Idempotent: check by (tenant, email, role=patient).
    existing = (
        await session.execute(
            select(User).where(
                User.tenant_id == tenant.id,
                User.email == PATIENT_EMAIL,
                User.role == Role.PATIENT,
                User.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        logger.info("patient user email=%s already present", PATIENT_EMAIL)
        return [existing]

    patient_user = User(
        email=PATIENT_EMAIL,
        password_hash=hasher.hash(raw_password),
        display_name=f"{patient.given_name} {patient.family_name}",
        role=Role.PATIENT,
        is_active=True,
        patient_id=patient.id,
    )
    await user_repo.add(patient_user)

    logger.info("seeded patient user email=%s role=%s", PATIENT_EMAIL, Role.PATIENT.value)
    print(f"Patient login: email={PATIENT_EMAIL} password=<{PATIENT_PASSWORD_ENV}>")  # noqa: T201

    return [patient_user]


async def _seed(session: AsyncSession) -> None:
    await seed_patient_users(session)


def main() -> None:
    raw = os.getenv(PATIENT_PASSWORD_ENV)
    if raw is None:
        print(  # noqa: T201
            f"ERROR: {PATIENT_PASSWORD_ENV} is unset — set it before seeding patient users",
            file=sys.stderr,
        )
        sys.exit(1)
    run_script(_seed)


if __name__ == "__main__":
    main()
