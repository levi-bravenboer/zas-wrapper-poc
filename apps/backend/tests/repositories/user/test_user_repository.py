from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.base import ListAllowListError
from app.repositories.user.user_repository import UserRepository
from app.schemas._list.list_query import ListQuery
from app.schemas.auth.auth import SessionUser
from scripts.seed_roles import (
    ADMIN_PERMISSIONS,
    ADMIN_ROLE_SLUG,
    DEFAULT_ROLE_SLUG,
    seed_roles,
)

# Per-tenant role-id map ({tenant_id: {slug: role_id}}), populated by
# `_make_tenant` so `_make_user` can FK a valid `role_id` without changing the
# helper's return signature.
_TENANT_ROLES: dict[uuid.UUID, dict[str, uuid.UUID]] = {}


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    """Tenant + its RBAC roles. Roles carry no user FKs (see the `Role`
    model), so no bootstrap user is needed; role ids land in `_TENANT_ROLES`
    for `_make_user` to FK."""
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    roles = await seed_roles(session, tenant_id=tenant.id)
    _TENANT_ROLES[tenant.id] = {
        ADMIN_ROLE_SLUG: roles[ADMIN_ROLE_SLUG].id,
        DEFAULT_ROLE_SLUG: roles[DEFAULT_ROLE_SLUG].id,
    }
    return tenant


async def _make_user(
    session: AsyncSession,
    *,
    tenant: Tenant,
    email: str,
    role_id: uuid.UUID | None = None,
    is_active: bool = True,
    external_idp: str | None = None,
    external_subject: str | None = None,
    password_hash: str | None = "hash",
    display_name: str | None = None,
) -> User:
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email=email,
        password_hash=password_hash,
        display_name=display_name or email,
        role_id=role_id or _TENANT_ROLES[tenant.id][DEFAULT_ROLE_SLUG],
        is_active=is_active,
        external_idp=external_idp,
        external_subject=external_subject,
    )
    session.add(user)
    await session.flush()
    return user


def _actor(user: User) -> SessionUser:
    return SessionUser(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        tenant_id=user.tenant_id,
        role_id=user.role_id,
        role_slug=ADMIN_ROLE_SLUG,
        permissions=ADMIN_PERMISSIONS,
    )


async def test_get_by_email_is_case_insensitive(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await _make_user(db_session, tenant=tenant, email="Admin@Zas.Local")
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.get_by_email(tenant.id, "ADMIN@zas.local")

    assert result is not None
    assert result.email == "Admin@Zas.Local"


async def test_list_page_scopes_to_actor_tenant(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    admin = await _make_user(
        db_session,
        tenant=zas,
        email="admin@zas.local",
        role_id=_TENANT_ROLES[zas.id][ADMIN_ROLE_SLUG],
    )
    await _make_user(db_session, tenant=zas, email="a@zas.local")
    await _make_user(db_session, tenant=other, email="a@other.local")
    await db_session.commit()

    db_session.info[SESSION_ACTOR_KEY] = _actor(admin)
    try:
        repo = UserRepository(db_session)
        page = await repo.list_page(ListQuery())
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)

    emails = {u.email for u in page.items}
    assert "a@zas.local" in emails
    assert "admin@zas.local" in emails
    assert "a@other.local" not in emails
    assert page.total == len(page.items)


async def test_list_page_filters_by_is_active(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(
        db_session,
        tenant=tenant,
        email="admin@zas.local",
        role_id=_TENANT_ROLES[tenant.id][ADMIN_ROLE_SLUG],
    )
    await _make_user(db_session, tenant=tenant, email="inactive@zas.local", is_active=False)
    await db_session.commit()

    db_session.info[SESSION_ACTOR_KEY] = _actor(admin)
    try:
        repo = UserRepository(db_session)
        active_page = await repo.list_page(ListQuery(filters={"is_active": {"eq": ["true"]}}))
        inactive_page = await repo.list_page(ListQuery(filters={"is_active": {"eq": ["false"]}}))
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)

    assert {u.email for u in active_page.items} == {"admin@zas.local"}
    assert {u.email for u in inactive_page.items} == {"inactive@zas.local"}


async def test_list_page_search_matches_email_and_display_name(
    db_session: AsyncSession,
) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(
        db_session,
        tenant=tenant,
        email="admin@zas.local",
        role_id=_TENANT_ROLES[tenant.id][ADMIN_ROLE_SLUG],
        display_name="Alice Admin",
    )
    await _make_user(db_session, tenant=tenant, email="bob@zas.local", display_name="Bob Bouwer")
    await db_session.commit()

    db_session.info[SESSION_ACTOR_KEY] = _actor(admin)
    try:
        repo = UserRepository(db_session)
        by_email = await repo.list_page(ListQuery(q="bob@"))
        by_display = await repo.list_page(ListQuery(q="alice"))
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)

    assert {u.email for u in by_email.items} == {"bob@zas.local"}
    assert {u.email for u in by_display.items} == {"admin@zas.local"}


async def test_list_page_rejects_unknown_filter(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(
        db_session,
        tenant=tenant,
        email="admin@zas.local",
        role_id=_TENANT_ROLES[tenant.id][ADMIN_ROLE_SLUG],
    )
    await db_session.commit()

    db_session.info[SESSION_ACTOR_KEY] = _actor(admin)
    try:
        repo = UserRepository(db_session)
        with pytest.raises(ListAllowListError):
            await repo.list_page(ListQuery(filters={"unknown": {"eq": ["x"]}}))
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)


async def test_list_page_default_order_is_display_name_asc(
    db_session: AsyncSession,
) -> None:
    tenant = await _make_tenant(db_session, "zas")
    admin = await _make_user(
        db_session,
        tenant=tenant,
        email="zz@zas.local",
        role_id=_TENANT_ROLES[tenant.id][ADMIN_ROLE_SLUG],
        display_name="Zoe",
    )
    await _make_user(db_session, tenant=tenant, email="aa@zas.local", display_name="Amy")
    await db_session.commit()

    db_session.info[SESSION_ACTOR_KEY] = _actor(admin)
    try:
        repo = UserRepository(db_session)
        page = await repo.list_page(ListQuery())
    finally:
        db_session.info.pop(SESSION_ACTOR_KEY, None)

    names = [u.display_name for u in page.items]
    assert names == ["Amy", "Zoe"]


async def test_get_by_external_identity_returns_row(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    user = await _make_user(
        db_session,
        tenant=tenant,
        email="ext@zas.local",
        external_idp="itsme",
        external_subject="abc-123",
    )
    await db_session.commit()

    repo = UserRepository(db_session)
    found = await repo.get_by_external_identity(tenant.id, "itsme", "abc-123")

    assert found is not None
    assert found.id == user.id


async def test_get_by_external_identity_returns_none_when_missing(
    db_session: AsyncSession,
) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await db_session.commit()

    repo = UserRepository(db_session)
    assert await repo.get_by_external_identity(tenant.id, "itsme", "missing") is None


async def test_get_by_external_identity_is_tenant_scoped(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    zas_user = await _make_user(
        db_session,
        tenant=zas,
        email="a@zas.local",
        external_idp="itsme",
        external_subject="shared-sub",
    )
    await _make_user(
        db_session,
        tenant=other,
        email="a@other.local",
        external_idp="itsme",
        external_subject="shared-sub",
    )
    await db_session.commit()

    repo = UserRepository(db_session)
    found = await repo.get_by_external_identity(zas.id, "itsme", "shared-sub")

    assert found is not None
    assert found.id == zas_user.id


async def test_duplicate_staff_email_same_role_violates_partial_unique(
    db_session: AsyncSession,
) -> None:
    """Staff uniqueness is now the partial index
    `UNIQUE(tenant_id, lower(email), role_id) WHERE patient_id IS NULL`
    (the old role-agnostic email unique + the role/patient CHECK are gone).
    Same email + same role within a tenant collides.
    """
    tenant = await _make_tenant(db_session, "zas")
    await _make_user(db_session, tenant=tenant, email="dup@zas.local")
    await db_session.commit()

    with pytest.raises(IntegrityError):
        # Same default role_id (from `_make_user`'s default) → collision.
        await _make_user(db_session, tenant=tenant, email="DUP@zas.local")
        await db_session.commit()
    await db_session.rollback()


async def test_same_staff_email_different_role_coexists(
    db_session: AsyncSession,
) -> None:
    """The staff partial index keys on `role_id`, so the same human email may
    appear once per role (e.g. a default-role + an admin-role row)."""
    tenant = await _make_tenant(db_session, "zas")
    await _make_user(
        db_session,
        tenant=tenant,
        email="multi@zas.local",
        role_id=_TENANT_ROLES[tenant.id][DEFAULT_ROLE_SLUG],
    )
    await _make_user(
        db_session,
        tenant=tenant,
        email="multi@zas.local",
        role_id=_TENANT_ROLES[tenant.id][ADMIN_ROLE_SLUG],
    )
    await db_session.commit()

    repo = UserRepository(db_session)
    # `get_by_email` without `role_id` is now ambiguous across roles; scope it.
    admin_match = await repo.get_by_email(
        tenant.id, "multi@zas.local", role_id=_TENANT_ROLES[tenant.id][ADMIN_ROLE_SLUG]
    )
    assert admin_match is not None
    assert admin_match.role_id == _TENANT_ROLES[tenant.id][ADMIN_ROLE_SLUG]


async def test_same_email_reusable_across_tenants(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    await _make_user(db_session, tenant=tenant, email="dup@zas.local")
    other = await _make_tenant(db_session, "other")
    await _make_user(db_session, tenant=other, email="dup@zas.local")
    await db_session.commit()

    repo = UserRepository(db_session)
    assert await repo.get_by_email(other.id, "dup@zas.local") is not None
