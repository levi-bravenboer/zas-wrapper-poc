from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from app.core.enums.audit import ActorType, AuditAction, AuditResult
from app.core.enums.user import Role
from app.db.models.audit import AuditEvent
from app.schemas.auth.auth import SessionUser
from app.services.audit.context import AuditContext
from app.services.audit.emit import emit_committed


def _actor() -> SessionUser:
    return SessionUser(
        id=uuid.uuid4(),
        email="actor@example.test",
        display_name="Emit Actor",
        tenant_id=uuid.uuid4(),
        role=Role.ADMIN,
    )


async def test_emit_committed_maps_explicit_actor(db_engine: AsyncEngine) -> None:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)
    actor = _actor()
    rid = uuid.uuid4()
    await emit_committed(factory, action=AuditAction.LOGIN, actor=actor, request_id=rid)

    async with factory() as session:
        result = await session.execute(select(AuditEvent).where(AuditEvent.request_id == rid))
        event = result.scalars().one()
    try:
        assert event.actor_type == ActorType.USER
        assert event.actor_id == actor.id
        assert event.actor_label == "Emit Actor"
        assert event.tenant_id == actor.tenant_id
    finally:
        async with factory() as session:
            await session.delete(event)
            await session.commit()


async def test_emit_committed_rejects_unknown_resource_type(db_engine: AsyncEngine) -> None:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)
    with pytest.raises(ValueError):
        await emit_committed(factory, action=AuditAction.UPDATED, resource_type="Nope")


async def test_emit_committed_persists_independently(db_engine: AsyncEngine) -> None:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)
    rid = uuid.uuid4()
    await emit_committed(
        factory,
        action=AuditAction.LOGIN,
        result=AuditResult.FAILURE,
        actor=None,
        request_id=rid,
        context=AuditContext.model_validate({"reason": "bad_password"}),
    )

    async with factory() as session:
        result = await session.execute(select(AuditEvent).where(AuditEvent.request_id == rid))
        event = result.scalars().one()
    try:
        assert event.action == AuditAction.LOGIN
        assert event.result == AuditResult.FAILURE
        assert event.actor_type == ActorType.ANONYMOUS
        assert event.context == {"reason": "bad_password"}
    finally:
        # cleanup (no autouse wipe in this test package)
        async with factory() as session:
            await session.delete(event)
            await session.commit()
