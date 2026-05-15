from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.auth.authenticator import PasswordAuthenticator
from app.services.auth.password import PasswordHasher


async def _seed(
    session: AsyncSession,
    *,
    password: str | None,
    is_active: bool = True,
) -> tuple[Tenant, User, PasswordHasher]:
    hasher = PasswordHasher()
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email="user@zas.local",
        password_hash=hasher.hash(password) if password is not None else None,
        display_name="User",
        role=Role.CAREGIVER,
        is_active=is_active,
        external_idp="itsme" if password is None else None,
        external_subject="opaque-sub" if password is None else None,
    )
    session.add(user)
    await session.commit()
    return tenant, user, hasher


async def test_authenticator_happy_path(db_session: AsyncSession) -> None:
    tenant, user, hasher = await _seed(db_session, password="s3cret")
    auth = PasswordAuthenticator(UserRepository(db_session), hasher, tenant_id=tenant.id)

    result = await auth.authenticate(email="user@zas.local", password="s3cret")

    assert result.ok
    assert result.user is not None
    assert result.user.id == user.id
    assert result.reason is None


async def test_authenticator_rejects_wrong_password(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret")
    auth = PasswordAuthenticator(UserRepository(db_session), hasher, tenant_id=tenant.id)

    result = await auth.authenticate(email="user@zas.local", password="wrong")

    assert not result.ok
    assert result.reason == "invalid_credentials"
    assert result.user is not None  # row exists, just bad password


async def test_authenticator_rejects_inactive_user(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret", is_active=False)
    auth = PasswordAuthenticator(UserRepository(db_session), hasher, tenant_id=tenant.id)

    result = await auth.authenticate(email="user@zas.local", password="s3cret")

    assert not result.ok
    assert result.reason == "inactive_user"
    assert result.user is None


async def test_authenticator_rejects_unknown_email(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret")
    auth = PasswordAuthenticator(UserRepository(db_session), hasher, tenant_id=tenant.id)

    result = await auth.authenticate(email="ghost@zas.local", password="s3cret")

    assert not result.ok
    assert result.reason == "unknown_email"
    assert result.user is None


async def test_authenticator_rejects_null_password_hash(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password=None)
    auth = PasswordAuthenticator(UserRepository(db_session), hasher, tenant_id=tenant.id)

    result = await auth.authenticate(email="user@zas.local", password="anything")

    assert not result.ok
    assert result.reason == "null_password_hash"
