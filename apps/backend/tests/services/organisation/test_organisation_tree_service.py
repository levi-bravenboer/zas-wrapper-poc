from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM, OrganisationTypeCode
from app.core.enums.user import Role
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.organisation import Organisation
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from app.schemas.organisation.tree import OrganisationTreeMove
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationNotFoundError,
    OrganisationTreeCycleError,
)
from app.services.organisation.organisation_tree_service import OrganisationTreeService


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    return tenant


async def _make_actor(session: AsyncSession, tenant: Tenant) -> User:
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email=f"{uuid.uuid4()}@example.test",
        password_hash="hash",
        display_name="actor",
        role=Role.ADMIN,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _make_org(
    session: AsyncSession,
    *,
    tenant: Tenant,
    actor: User,
    name: str,
    parent: Organisation | None = None,
    sort_index: int = 0,
) -> Organisation:
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name=name,
        type_code=OrganisationTypeCode.PROVIDER.value,
        type_system=ORGANISATION_TYPE_SYSTEM,
        type_display=None,
        parent_organisation_id=parent.id if parent is not None else None,
        sort_index=sort_index,
    )
    session.add(org)
    await session.flush()
    return org


def _session_user(actor: User) -> SessionUser:
    return SessionUser(
        id=actor.id,
        email=actor.email,
        display_name=actor.display_name,
        tenant_id=actor.tenant_id,
        role=actor.role,
    )


def _set_actor(session: AsyncSession, actor: User) -> None:
    session.sync_session.info[SESSION_ACTOR_KEY] = _session_user(actor)


async def test_single_reparent_persists_parent_and_sort_index(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_actor(db_session, tenant)
    root = await _make_org(db_session, tenant=tenant, actor=actor, name="Root")
    child = await _make_org(db_session, tenant=tenant, actor=actor, name="Child")
    await db_session.commit()
    _set_actor(db_session, actor)

    moves = [OrganisationTreeMove(id=child.id, parent_organisation_id=root.id, sort_index=2)]
    service = OrganisationTreeService(db_session)
    refreshed = await service.apply_tree_moves(_session_user(actor), moves)
    await db_session.commit()

    refreshed_child = next(o for o in refreshed if o.id == child.id)
    assert refreshed_child.parent_organisation_id == root.id
    assert refreshed_child.sort_index == 2


async def test_sibling_reorder_only_updates_sort_index(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_actor(db_session, tenant)
    root = await _make_org(db_session, tenant=tenant, actor=actor, name="Root")
    a = await _make_org(db_session, tenant=tenant, actor=actor, name="A", parent=root, sort_index=0)
    b = await _make_org(db_session, tenant=tenant, actor=actor, name="B", parent=root, sort_index=1)
    c = await _make_org(db_session, tenant=tenant, actor=actor, name="C", parent=root, sort_index=2)
    await db_session.commit()
    _set_actor(db_session, actor)

    service = OrganisationTreeService(db_session)
    refreshed = await service.apply_tree_moves(
        _session_user(actor),
        [
            OrganisationTreeMove(id=a.id, parent_organisation_id=root.id, sort_index=2),
            OrganisationTreeMove(id=b.id, parent_organisation_id=root.id, sort_index=0),
            OrganisationTreeMove(id=c.id, parent_organisation_id=root.id, sort_index=1),
        ],
    )
    await db_session.commit()

    by_id = {o.id: o for o in refreshed}
    assert by_id[a.id].sort_index == 2
    assert by_id[b.id].sort_index == 0
    assert by_id[c.id].sort_index == 1
    assert by_id[a.id].parent_organisation_id == root.id
    assert by_id[b.id].parent_organisation_id == root.id
    assert by_id[c.id].parent_organisation_id == root.id


async def test_cycle_rejected_with_no_partial_write(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_actor(db_session, tenant)
    root = await _make_org(db_session, tenant=tenant, actor=actor, name="Root")
    child = await _make_org(db_session, tenant=tenant, actor=actor, name="Child", parent=root)
    grandchild = await _make_org(db_session, tenant=tenant, actor=actor, name="Grand", parent=child)
    root_id = root.id
    grandchild_id = grandchild.id
    await db_session.commit()
    _set_actor(db_session, actor)

    service = OrganisationTreeService(db_session)
    with pytest.raises(OrganisationTreeCycleError):
        await service.apply_tree_moves(
            _session_user(actor),
            [
                OrganisationTreeMove(
                    id=root_id, parent_organisation_id=grandchild_id, sort_index=0
                ),
            ],
        )
    await db_session.rollback()
    db_session.expire_all()

    row = (
        await db_session.execute(select(Organisation).where(Organisation.id == root_id))
    ).scalar_one()
    assert row.parent_organisation_id is None


async def test_indirect_cycle_via_overlay_rejected(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_actor(db_session, tenant)
    a = await _make_org(db_session, tenant=tenant, actor=actor, name="A")
    b = await _make_org(db_session, tenant=tenant, actor=actor, name="B", parent=a)
    await db_session.commit()
    _set_actor(db_session, actor)

    service = OrganisationTreeService(db_session)
    with pytest.raises(OrganisationTreeCycleError):
        await service.apply_tree_moves(
            _session_user(actor),
            [
                OrganisationTreeMove(id=a.id, parent_organisation_id=b.id, sort_index=0),
                OrganisationTreeMove(id=b.id, parent_organisation_id=a.id, sort_index=0),
            ],
        )


async def test_cross_tenant_parent_rejected(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    zas_actor = await _make_actor(db_session, zas)
    other_actor = await _make_actor(db_session, other)
    zas_root = await _make_org(db_session, tenant=zas, actor=zas_actor, name="ZRoot")
    other_root = await _make_org(db_session, tenant=other, actor=other_actor, name="ORoot")
    await db_session.commit()
    _set_actor(db_session, zas_actor)

    service = OrganisationTreeService(db_session)
    with pytest.raises(CrossTenantOrganisationError):
        await service.apply_tree_moves(
            _session_user(zas_actor),
            [
                OrganisationTreeMove(
                    id=zas_root.id, parent_organisation_id=other_root.id, sort_index=0
                ),
            ],
        )


async def test_unknown_id_rejected(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_actor(db_session, tenant)
    await db_session.commit()
    _set_actor(db_session, actor)

    service = OrganisationTreeService(db_session)
    with pytest.raises(OrganisationNotFoundError):
        await service.apply_tree_moves(
            _session_user(actor),
            [
                OrganisationTreeMove(id=uuid.uuid4(), parent_organisation_id=None, sort_index=0),
            ],
        )


async def test_cross_tenant_target_rejected_as_not_found(db_session: AsyncSession) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    zas_actor = await _make_actor(db_session, zas)
    other_actor = await _make_actor(db_session, other)
    other_org = await _make_org(db_session, tenant=other, actor=other_actor, name="OOrg")
    await db_session.commit()
    _set_actor(db_session, zas_actor)

    service = OrganisationTreeService(db_session)
    with pytest.raises(OrganisationNotFoundError):
        await service.apply_tree_moves(
            _session_user(zas_actor),
            [
                OrganisationTreeMove(id=other_org.id, parent_organisation_id=None, sort_index=0),
            ],
        )


async def test_duplicate_ids_rejected(db_session: AsyncSession) -> None:
    tenant = await _make_tenant(db_session, "zas")
    actor = await _make_actor(db_session, tenant)
    org = await _make_org(db_session, tenant=tenant, actor=actor, name="X")
    await db_session.commit()
    _set_actor(db_session, actor)

    service = OrganisationTreeService(db_session)
    with pytest.raises(OrganisationTreeCycleError):
        await service.apply_tree_moves(
            _session_user(actor),
            [
                OrganisationTreeMove(id=org.id, parent_organisation_id=None, sort_index=0),
                OrganisationTreeMove(id=org.id, parent_organisation_id=None, sort_index=1),
            ],
        )
