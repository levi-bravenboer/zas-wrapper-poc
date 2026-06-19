from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from scripts.seed_tenant import ZAS_TENANT_ID, seed_zas_tenant
from scripts.seed_users import (
    ADMIN_EMAIL,
    ADMIN_USER_ID,
    CAREGIVER_EMAIL,
    CLINICAL_CAST,
    admin_role_id,
    _ZasTenantMissingError,
    seed_users,
)
from tests.scripts._util import run_script_subprocess


async def test_seed_users_inserts_bootstrap_pair(db_session: AsyncSession) -> None:
    await seed_zas_tenant(db_session)
    await db_session.commit()

    users = await seed_users(db_session)
    await db_session.commit()

    by_email = {u.email: u for u in users}
    admin = by_email[ADMIN_EMAIL]
    caregiver = by_email[CAREGIVER_EMAIL]

    assert admin.id == ADMIN_USER_ID
    assert admin.tenant_id == ZAS_TENANT_ID
    # Admin is bound to the per-tenant `admin` role (was `role is Role.ADMIN`).
    assert admin.role_id == admin_role_id(ZAS_TENANT_ID)
    # Self-FK for bootstrap admin: created_by / updated_by point at admin.
    assert admin.created_by == ADMIN_USER_ID
    assert admin.updated_by == ADMIN_USER_ID

    assert caregiver.tenant_id == ZAS_TENANT_ID
    # Caregivers get the `default` role, not the admin role (was Role.CAREGIVER).
    assert caregiver.role_id != admin_role_id(ZAS_TENANT_ID)
    assert caregiver.patient_id is None
    # Audit hook stamped caregiver's `created_by` from the admin actor.
    assert caregiver.created_by == ADMIN_USER_ID
    assert caregiver.updated_by == ADMIN_USER_ID


async def test_seed_users_is_idempotent(db_session: AsyncSession) -> None:
    await seed_zas_tenant(db_session)
    await db_session.commit()

    await seed_users(db_session)
    await db_session.commit()
    await seed_users(db_session)
    await db_session.commit()

    count = (await db_session.execute(select(func.count()).select_from(User))).scalar_one()
    # admin + demo caregiver + the specialty cast (§6c.2).
    assert count == 2 + len(CLINICAL_CAST)


async def test_seed_users_requires_existing_tenant(db_session: AsyncSession) -> None:
    with pytest.raises(_ZasTenantMissingError):
        await seed_users(db_session)


def test_seed_users_script_main_exits_clean() -> None:
    # Tenant must exist; this test runs after `clean_tenants` wiped it, so the
    # script first needs the tenant. Use `seed_all` which composes both seeds.
    result = run_script_subprocess("scripts.seed_all")
    assert result.returncode == 0, result.stderr


def test_seed_users_script_without_tenant_exits_nonzero() -> None:
    result = run_script_subprocess("scripts.seed_users")
    assert result.returncode != 0
    assert "tenant missing" in result.stderr or "tenant missing" in result.stdout
