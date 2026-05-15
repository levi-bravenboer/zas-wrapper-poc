from __future__ import annotations

import uuid

import pytest
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.auth.authenticator import PasswordAuthenticator
from app.services.auth.errors import InvalidCredentialsError
from app.services.auth.password import PasswordHasher
from app.services.auth.providers import PasswordLoginProvider


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


def _provider(
    session: AsyncSession, tenant_id: uuid.UUID, hasher: PasswordHasher
) -> PasswordLoginProvider:
    authenticator = PasswordAuthenticator(UserRepository(session), hasher, tenant_id=tenant_id)
    return PasswordLoginProvider(authenticator)


async def test_password_provider_happy_path(db_session: AsyncSession) -> None:
    tenant, user, hasher = await _seed(db_session, password="s3cret")
    provider = _provider(db_session, tenant.id, hasher)

    session_user = await provider.authenticate(email="user@zas.local", password=SecretStr("s3cret"))

    assert session_user.id == user.id


async def test_password_provider_invalid_credentials(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret")
    provider = _provider(db_session, tenant.id, hasher)

    with pytest.raises(InvalidCredentialsError):
        await provider.authenticate(email="user@zas.local", password=SecretStr("wrong"))


async def test_password_provider_inactive_user(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret", is_active=False)
    provider = _provider(db_session, tenant.id, hasher)

    with pytest.raises(InvalidCredentialsError):
        await provider.authenticate(email="user@zas.local", password=SecretStr("s3cret"))


async def test_password_provider_null_hash_user(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password=None)
    provider = _provider(db_session, tenant.id, hasher)

    with pytest.raises(InvalidCredentialsError):
        await provider.authenticate(email="user@zas.local", password=SecretStr("anything"))


async def test_try_authenticate_exposes_reason(db_session: AsyncSession) -> None:
    tenant, _, hasher = await _seed(db_session, password="s3cret")
    provider = _provider(db_session, tenant.id, hasher)

    outcome = await provider.try_authenticate(email="ghost@zas.local", password=SecretStr("x"))

    assert outcome.session_user is None
    assert outcome.reason == "unknown_email"
    assert outcome.user_id is None
