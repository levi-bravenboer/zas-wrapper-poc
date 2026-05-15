from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    return tenant


async def _make_user(
    session: AsyncSession,
    *,
    tenant: Tenant,
    email: str,
    role: Role = Role.CAREGIVER,
    is_active: bool = True,
) -> User:
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email=email,
        password_hash="hash",
        display_name=email,
        role=role,
        is_active=is_active,
    )
    session.add(user)
    await session.flush()
    return user


async def test_get_by_email_is_case_insensitive(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await _make_user(db_session, tenant=tenant, email="Admin@Zas.Local")
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.get_by_email(tenant.id, "ADMIN@zas.local")

    assert result is not None
    assert result.email == "Admin@Zas.Local"


async def test_list_in_tenant_scopes_results(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    await _make_user(db_session, tenant=zas, email="a@zas.local")
    await _make_user(db_session, tenant=other, email="a@other.local")
    await db_session.commit()

    repo = UserRepository(db_session)
    rows = await repo.list_in_tenant(zas.id)

    assert len(rows) == 1
    assert rows[0].tenant_id == zas.id


async def test_list_in_tenant_filters_by_active(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await _make_user(db_session, tenant=tenant, email="active@zas.local")
    await _make_user(db_session, tenant=tenant, email="inactive@zas.local", is_active=False)
    await db_session.commit()

    repo = UserRepository(db_session)
    active = await repo.list_in_tenant(tenant.id, active=True)
    inactive = await repo.list_in_tenant(tenant.id, active=False)

    assert [u.email for u in active] == ["active@zas.local"]
    assert [u.email for u in inactive] == ["inactive@zas.local"]


async def test_duplicate_lower_email_per_tenant_violates_unique(
    db_session: AsyncSession,
) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await _make_user(db_session, tenant=tenant, email="dup@zas.local")
    await db_session.commit()

    repo = UserRepository(db_session)
    with pytest.raises(IntegrityError):
        await _make_user(db_session, tenant=tenant, email="DUP@zas.local")
        await db_session.commit()
    await db_session.rollback()

    # Sanity: same email is reusable across tenants.
    other = await _make_tenant(db_session, "other")
    await _make_user(db_session, tenant=other, email="dup@zas.local")
    await db_session.commit()
    assert await repo.get_by_email(other.id, "dup@zas.local") is not None
