from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM, OrganisationTypeCode
from app.db.models.organisation import Organisation
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.organisation.organisation_repository import OrganisationRepository
from scripts.seed_roles import bootstrap_admin_role
from scripts.seed_users import admin_role_id


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    return tenant


async def _make_user(session: AsyncSession, tenant: Tenant) -> User:
    """Self-referencing admin user + its `admin` role (FK cycle, replica block)."""
    user_id = uuid.uuid4()
    role_id = admin_role_id(tenant.id)
    await session.execute(text("SET session_replication_role = replica"))
    try:
        user = User(
            id=user_id,
            tenant_id=tenant.id,
            created_by=user_id,
            updated_by=user_id,
            email=f"{uuid.uuid4()}@example.test",
            password_hash="hash",
            display_name="actor",
            role_id=role_id,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        await bootstrap_admin_role(session, role_id=role_id, tenant_id=tenant.id)
    finally:
        await session.execute(text("SET session_replication_role = DEFAULT"))
    return user


async def _make_org(
    session: AsyncSession,
    *,
    tenant: Tenant,
    actor_id: uuid.UUID,
    name: str,
    type_code: OrganisationTypeCode,
    parent: Organisation | None = None,
) -> Organisation:
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        name=name,
        type_code=type_code.value,
        type_system=ORGANISATION_TYPE_SYSTEM,
        type_display=None,
        parent_organisation_id=parent.id if parent is not None else None,
    )
    session.add(org)
    await session.flush()
    return org


async def test_list_in_tenant_scopes_results(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    actor_zas = await _make_user(db_session, zas)
    actor_other = await _make_user(db_session, other)
    await _make_org(
        db_session,
        tenant=zas,
        actor_id=actor_zas.id,
        name="ZAS",
        type_code=OrganisationTypeCode.PROVIDER,
    )
    await _make_org(
        db_session,
        tenant=other,
        actor_id=actor_other.id,
        name="OTHER",
        type_code=OrganisationTypeCode.PROVIDER,
    )
    await db_session.commit()

    repo = OrganisationRepository(db_session)
    rows = await repo.list_in_tenant(zas.id)

    assert {o.name for o in rows} == {"ZAS"}


async def test_get_root_ancestor_walks_up(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_user(db_session, tenant)
    root = await _make_org(
        db_session,
        tenant=tenant,
        actor_id=actor.id,
        name="root",
        type_code=OrganisationTypeCode.PROVIDER,
    )
    dept = await _make_org(
        db_session,
        tenant=tenant,
        actor_id=actor.id,
        name="dept",
        type_code=OrganisationTypeCode.DEPARTMENT,
        parent=root,
    )
    team = await _make_org(
        db_session,
        tenant=tenant,
        actor_id=actor.id,
        name="team",
        type_code=OrganisationTypeCode.TEAM,
        parent=dept,
    )
    await db_session.commit()

    repo = OrganisationRepository(db_session)
    found = await repo.get_root_ancestor(team.id)

    assert found is not None
    assert found.id == root.id


async def test_get_root_ancestor_for_root_returns_self(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_user(db_session, tenant)
    root = await _make_org(
        db_session,
        tenant=tenant,
        actor_id=actor.id,
        name="root",
        type_code=OrganisationTypeCode.PROVIDER,
    )
    await db_session.commit()

    repo = OrganisationRepository(db_session)
    found = await repo.get_root_ancestor(root.id)

    assert found is not None
    assert found.id == root.id


async def test_get_descendant_ids_includes_self_and_children(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_user(db_session, tenant)
    root = await _make_org(
        db_session,
        tenant=tenant,
        actor_id=actor.id,
        name="root",
        type_code=OrganisationTypeCode.PROVIDER,
    )
    dept = await _make_org(
        db_session,
        tenant=tenant,
        actor_id=actor.id,
        name="dept",
        type_code=OrganisationTypeCode.DEPARTMENT,
        parent=root,
    )
    team = await _make_org(
        db_session,
        tenant=tenant,
        actor_id=actor.id,
        name="team",
        type_code=OrganisationTypeCode.TEAM,
        parent=dept,
    )
    await db_session.commit()

    repo = OrganisationRepository(db_session)
    ids = set(await repo.get_descendant_ids(root.id))

    assert ids == {root.id, dept.id, team.id}
