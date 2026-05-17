# Exercises the SQL backfill from migration `a1f5b9c2d4e7`
# (add_organisations_sort_index). The test DB uses `Base.metadata.create_all`
# instead of running alembic, so we seed siblings (all default to
# `sort_index = 0`), run the UPDATE statement verbatim from the migration,
# and assert each sibling group is renumbered contiguously by `name` asc.

from __future__ import annotations

import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM, OrganisationTypeCode
from app.db.models.organisation import Organisation
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.core.enums.user import Role


BACKFILL_SQL = """
UPDATE organisations
SET sort_index = sub.rn - 1
FROM (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY parent_organisation_id
               ORDER BY name, id
           ) AS rn
    FROM organisations
) sub
WHERE organisations.id = sub.id;
"""


async def _make_tenant(session: AsyncSession, slug: str) -> Tenant:
    tenant = Tenant(id=uuid.uuid4(), slug=slug, name=slug.upper())
    session.add(tenant)
    await session.flush()
    return tenant


async def _make_user(session: AsyncSession, tenant: Tenant) -> User:
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
    actor_id: uuid.UUID,
    name: str,
    parent: Organisation | None = None,
) -> Organisation:
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        name=name,
        type_code=OrganisationTypeCode.PROVIDER.value,
        type_system=ORGANISATION_TYPE_SYSTEM,
        type_display=None,
        parent_organisation_id=parent.id if parent is not None else None,
    )
    session.add(org)
    await session.flush()
    return org


async def test_backfill_numbers_siblings_zero_indexed_by_name(
    db_session: AsyncSession,
) -> None:
    tenant = await _make_tenant(db_session, "zas")
    tenant_id = tenant.id
    actor = await _make_user(db_session, tenant)
    root = await _make_org(db_session, tenant=tenant, actor_id=actor.id, name="Charlie")
    await _make_org(db_session, tenant=tenant, actor_id=actor.id, name="Alpha")
    await _make_org(db_session, tenant=tenant, actor_id=actor.id, name="Bravo")
    await _make_org(db_session, tenant=tenant, actor_id=actor.id, name="Yankee", parent=root)
    await _make_org(db_session, tenant=tenant, actor_id=actor.id, name="Xray", parent=root)
    await _make_org(db_session, tenant=tenant, actor_id=actor.id, name="Zulu", parent=root)
    await db_session.commit()

    await db_session.execute(text(BACKFILL_SQL))
    await db_session.commit()
    db_session.expire_all()

    rows = (
        (await db_session.execute(select(Organisation).where(Organisation.tenant_id == tenant_id)))
        .scalars()
        .all()
    )
    by_name = {o.name: o for o in rows}

    assert by_name["Alpha"].sort_index == 0
    assert by_name["Bravo"].sort_index == 1
    assert by_name["Charlie"].sort_index == 2
    assert by_name["Xray"].sort_index == 0
    assert by_name["Yankee"].sort_index == 1
    assert by_name["Zulu"].sort_index == 2


async def test_backfill_partitions_per_parent_across_tenants(
    db_session: AsyncSession,
) -> None:
    zas = await _make_tenant(db_session, "zas")
    other = await _make_tenant(db_session, "other")
    actor_zas = await _make_user(db_session, zas)
    actor_other = await _make_user(db_session, other)
    await _make_org(db_session, tenant=zas, actor_id=actor_zas.id, name="Alpha")
    await _make_org(db_session, tenant=other, actor_id=actor_other.id, name="Bravo")
    await db_session.commit()

    await db_session.execute(text(BACKFILL_SQL))
    await db_session.commit()
    db_session.expire_all()

    rows = (await db_session.execute(select(Organisation))).scalars().all()
    by_name = {o.name: o for o in rows}

    # Both roots, distinct tenants, but same NULL parent — share one partition.
    assert {by_name["Alpha"].sort_index, by_name["Bravo"].sort_index} == {0, 1}
