from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM, OrganisationTypeCode
from app.db.models.organisation import Organisation
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.organisation.organisation_repository import OrganisationRepository
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationNotFoundError,
)
from app.services.organisation.organisation_service import OrganisationService
from tests._rbac import ensure_roles


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    return tenant


async def _make_actor(session: AsyncSession, tenant: Tenant) -> User:
    user_id = uuid.uuid4()
    roles = await ensure_roles(session, tenant.id)
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email=f"{uuid.uuid4()}@example.test",
        password_hash="hash",
        display_name="actor",
        role_id=roles["admin"].id,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _make_org(session: AsyncSession, *, tenant: Tenant, actor: User) -> Organisation:
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code=OrganisationTypeCode.PROVIDER.value,
        type_system=ORGANISATION_TYPE_SYSTEM,
        type_display=None,
        parent_organisation_id=None,
    )
    session.add(org)
    await session.flush()
    return org


async def test_assert_same_tenant_parent_allows_match(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_actor(db_session, tenant)
    root = await _make_org(db_session, tenant=tenant, actor=actor)
    await db_session.commit()

    service = OrganisationService(db_session, OrganisationRepository(db_session))
    await service.assert_same_tenant_parent(tenant.id, root.id)


async def test_assert_same_tenant_parent_rejects_cross_tenant(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    zas_actor = await _make_actor(db_session, zas)
    other_actor = await _make_actor(db_session, other)
    other_root = await _make_org(db_session, tenant=other, actor=other_actor)
    await db_session.commit()
    del zas_actor

    service = OrganisationService(db_session, OrganisationRepository(db_session))
    with pytest.raises(CrossTenantOrganisationError):
        await service.assert_same_tenant_parent(zas.id, other_root.id)


async def test_assert_same_tenant_parent_raises_when_missing(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await db_session.commit()

    service = OrganisationService(db_session, OrganisationRepository(db_session))
    with pytest.raises(OrganisationNotFoundError):
        await service.assert_same_tenant_parent(tenant.id, uuid.uuid4())


async def test_assert_same_tenant_parent_noop_when_none(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await db_session.commit()

    service = OrganisationService(db_session, OrganisationRepository(db_session))
    await service.assert_same_tenant_parent(tenant.id, None)
