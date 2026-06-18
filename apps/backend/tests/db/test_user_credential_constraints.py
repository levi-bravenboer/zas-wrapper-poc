from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import Tenant
from app.db.models.user import User
from tests.db.conftest import seed_admin_user

# Per-tenant role id ({tenant_id: role_id}) so credential-constraint inserts
# can FK a valid `role_id` (the deleted `Role` enum no longer exists).
_TENANT_ROLE: dict[uuid.UUID, uuid.UUID] = {}


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    # Seed a self-referencing admin + its role so plain user rows below have a
    # valid `role_id` FK target.
    admin = await seed_admin_user(session, tenant_id=tenant.id, email=f"admin-{slug}@zas.local")
    _TENANT_ROLE[tenant.id] = admin.role_id
    return tenant


def _user(
    tenant_id: uuid.UUID,
    *,
    email: str,
    password_hash: str | None,
    external_idp: str | None = None,
    external_subject: str | None = None,
) -> User:
    user_id = uuid.uuid4()
    return User(
        id=user_id,
        tenant_id=tenant_id,
        created_by=user_id,
        updated_by=user_id,
        email=email,
        password_hash=password_hash,
        display_name=email,
        role_id=_TENANT_ROLE[tenant_id],
        is_active=True,
        external_idp=external_idp,
        external_subject=external_subject,
    )


async def test_external_only_row_inserts(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    db_session.add(
        _user(
            tenant.id,
            email="ext@zas.local",
            password_hash=None,
            external_idp="itsme",
            external_subject="abc-123",
        )
    )
    await db_session.commit()


async def test_row_with_no_credential_rejected(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    db_session.add(_user(tenant.id, email="nocred@zas.local", password_hash=None))
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


async def test_duplicate_external_subject_per_tenant_rejected(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    db_session.add(
        _user(
            tenant.id,
            email="a@zas.local",
            password_hash=None,
            external_idp="itsme",
            external_subject="sub-1",
        )
    )
    await db_session.commit()

    db_session.add(
        _user(
            tenant.id,
            email="b@zas.local",
            password_hash=None,
            external_idp="itsme",
            external_subject="sub-1",
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


async def test_two_null_external_subjects_coexist(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    db_session.add(_user(tenant.id, email="a@zas.local", password_hash="h"))
    db_session.add(_user(tenant.id, email="b@zas.local", password_hash="h"))
    await db_session.commit()


async def test_same_external_subject_across_tenants_allowed(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    db_session.add(
        _user(
            zas.id,
            email="a@zas.local",
            password_hash=None,
            external_idp="itsme",
            external_subject="sub-1",
        )
    )
    db_session.add(
        _user(
            other.id,
            email="a@other.local",
            password_hash=None,
            external_idp="itsme",
            external_subject="sub-1",
        )
    )
    await db_session.commit()
