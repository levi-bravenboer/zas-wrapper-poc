from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.tenant import Tenant
from app.realtime.flush_hook import install_realtime_flush_hook
from app.realtime.pubsub import RealtimePubSub, set_pubsub_for_tests

from tests.repositories._list.conftest import _DemoModel, make_actor


@pytest.fixture
def bus() -> Iterator[RealtimePubSub]:
    install_realtime_flush_hook()
    bus = RealtimePubSub()
    previous = set_pubsub_for_tests(bus)
    try:
        yield bus
    finally:
        if previous is not None:
            set_pubsub_for_tests(previous)


async def _collect(bus: RealtimePubSub, tenant_id: uuid.UUID, count: int, timeout: float = 1.0):
    received = []

    async def _drain():
        async for event in bus.subscribe(tenant_id):
            received.append(event)
            if len(received) >= count:
                return

    try:
        await asyncio.wait_for(_drain(), timeout=timeout)
    except asyncio.TimeoutError:
        pass
    return received


async def test_commit_publishes_upsert_for_new_row(
    bus: RealtimePubSub,
    db_session: AsyncSession,
    two_tenants: tuple[Tenant, Tenant, object, object],
) -> None:
    alpha, _, alpha_admin, _ = two_tenants
    db_session.info[SESSION_ACTOR_KEY] = make_actor(
        user_id=alpha_admin.id, tenant_id=alpha.id
    )
    drain = asyncio.create_task(_collect(bus, alpha.id, count=1))
    await asyncio.sleep(0.05)

    row = _DemoModel(
        tenant_id=alpha.id,
        created_by=alpha_admin.id,
        updated_by=alpha_admin.id,
        name="x",
        status="open",
        score=1,
    )
    db_session.add(row)
    await db_session.commit()

    received = await drain
    assert len(received) == 1
    assert received[0].resource == "demo"
    assert received[0].action == "upsert"


async def test_rollback_discards_pending_events(
    bus: RealtimePubSub,
    db_session: AsyncSession,
    two_tenants: tuple[Tenant, Tenant, object, object],
) -> None:
    alpha, _, alpha_admin, _ = two_tenants
    alpha_id = alpha.id
    db_session.info[SESSION_ACTOR_KEY] = make_actor(
        user_id=alpha_admin.id, tenant_id=alpha_id
    )

    row = _DemoModel(
        tenant_id=alpha_id,
        created_by=alpha_admin.id,
        updated_by=alpha_admin.id,
        name="x",
        status="open",
        score=1,
    )
    db_session.add(row)
    await db_session.flush()
    await db_session.rollback()

    received = await _collect(bus, alpha_id, count=1, timeout=0.2)
    assert received == []


async def test_soft_delete_emits_upsert(
    bus: RealtimePubSub,
    db_session: AsyncSession,
    two_tenants: tuple[Tenant, Tenant, object, object],
) -> None:
    alpha, _, alpha_admin, _ = two_tenants
    db_session.info[SESSION_ACTOR_KEY] = make_actor(
        user_id=alpha_admin.id, tenant_id=alpha.id
    )
    row = _DemoModel(
        tenant_id=alpha.id,
        created_by=alpha_admin.id,
        updated_by=alpha_admin.id,
        name="x",
        status="open",
        score=1,
    )
    db_session.add(row)
    await db_session.commit()

    drain = asyncio.create_task(_collect(bus, alpha.id, count=1))
    await asyncio.sleep(0.05)

    row.deleted_at = sa.func.now()
    await db_session.commit()

    received = await drain
    assert received[0].action == "upsert"


async def test_multi_row_commit_publishes_per_row(
    bus: RealtimePubSub,
    db_session: AsyncSession,
    two_tenants: tuple[Tenant, Tenant, object, object],
) -> None:
    alpha, _, alpha_admin, _ = two_tenants
    db_session.info[SESSION_ACTOR_KEY] = make_actor(
        user_id=alpha_admin.id, tenant_id=alpha.id
    )

    drain = asyncio.create_task(_collect(bus, alpha.id, count=3))
    await asyncio.sleep(0.05)

    for i in range(3):
        db_session.add(
            _DemoModel(
                tenant_id=alpha.id,
                created_by=alpha_admin.id,
                updated_by=alpha_admin.id,
                name=f"row-{i}",
                status="open",
                score=i,
            )
        )
    await db_session.commit()

    received = await drain
    assert len(received) == 3


async def test_tenant_id_drives_fan_out_not_actor_tenant(
    bus: RealtimePubSub,
    db_session: AsyncSession,
    two_tenants: tuple[Tenant, Tenant, object, object],
) -> None:
    """Cross-tenant admin write: event must reach the row's tenant, not the actor's."""
    alpha, beta, alpha_admin, _ = two_tenants
    db_session.info[SESSION_ACTOR_KEY] = make_actor(
        user_id=alpha_admin.id, tenant_id=alpha.id
    )

    drain_alpha = asyncio.create_task(_collect(bus, alpha.id, count=1, timeout=0.3))
    drain_beta = asyncio.create_task(_collect(bus, beta.id, count=1, timeout=0.3))
    await asyncio.sleep(0.05)

    db_session.add(
        _DemoModel(
            tenant_id=beta.id,
            created_by=alpha_admin.id,
            updated_by=alpha_admin.id,
            name="cross",
            status="open",
            score=0,
        )
    )
    await db_session.commit()

    assert (await drain_alpha) == []
    received = await drain_beta
    assert received[0].resource == "demo"
