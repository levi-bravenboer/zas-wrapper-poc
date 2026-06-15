from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.core.enums.audit import ActorType, AuditAction, AuditResult
from app.core.enums.user import Role
from app.db.models.audit import AuditEvent
from app.schemas.auth.auth import SessionUser
from app.services.audit.context import AuditContext, FieldChange
from app.services.audit.emit import emit, emit_committed


def _actor() -> SessionUser:
    return SessionUser(
        id=uuid.uuid4(),
        email="actor@example.test",
        display_name="Emit Actor",
        tenant_id=uuid.uuid4(),
        role=Role.ADMIN,
    )


async def _by_resource(session: AsyncSession, resource_id: uuid.UUID) -> AuditEvent | None:
    result = await session.execute(
        select(AuditEvent).where(AuditEvent.resource_id == resource_id)
    )
    return result.scalars().first()


async def test_emit_with_explicit_actor(db_session: AsyncSession) -> None:
    actor = _actor()
    rid = uuid.uuid4()
    await emit(
        db_session,
        action=AuditAction.PUBLISHED,
        resource_type="Pathway",
        resource_id=rid,
        changes={"status": FieldChange(old="draft", new="live")},
        actor=actor,
    )
    await db_session.flush()

    event = await _by_resource(db_session, rid)
    assert event is not None
    assert event.actor_type == ActorType.USER
    assert event.actor_id == actor.id
    assert event.actor_label == "Emit Actor"
    assert event.tenant_id == actor.tenant_id
    assert event.changes == {"status": {"old": "draft", "new": "live"}}


async def test_emit_without_actor_is_anonymous(db_session: AsyncSession) -> None:
    rid = uuid.uuid4()
    await emit(db_session, action=AuditAction.EXPORTED, resource_type="Patient", resource_id=rid)
    await db_session.flush()

    event = await _by_resource(db_session, rid)
    assert event is not None
    assert event.actor_type == ActorType.ANONYMOUS
    assert event.actor_id is None


async def test_emit_rejects_unknown_resource_type(db_session: AsyncSession) -> None:
    with pytest.raises(ValueError):
        await emit(db_session, action=AuditAction.UPDATED, resource_type="Nope")


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
        result = await session.execute(
            select(AuditEvent).where(AuditEvent.request_id == rid)
        )
        event = result.scalars().one()
    assert event.action == AuditAction.LOGIN
    assert event.result == AuditResult.FAILURE
    assert event.actor_type == ActorType.ANONYMOUS
    assert event.context == {"reason": "bad_password"}

    # cleanup (no autouse wipe in this test package)
    async with factory() as session:
        await session.delete(event)
        await session.commit()
