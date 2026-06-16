"""Write API for the audit trail.

`emit_committed()` records a security event in its OWN short-lived session and
commits independently, so it survives a rolled-back / 4xx request (e.g. a failed
login that returns 401). This is the single deliberate exception to the
"services never commit" rule, contained here on purpose.

Automatic create/update/delete capture for `__audited__` models lives in the
`before_flush` hook (`app.db.audit`), not here.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.enums.audit import ActorType, AuditAction, AuditResult
from app.schemas.auth.auth import SessionUser
from app.services.audit.context import AuditContext, FieldChange
from app.services.audit.registry import is_known_resource
from app.services.audit.serialize import json_safe


def _actor_fields(actor: SessionUser | None) -> tuple[ActorType, UUID | None, str | None, UUID | None]:
    if actor is None:
        return ActorType.ANONYMOUS, None, None, None
    return ActorType.USER, actor.id, actor.display_name, actor.tenant_id


def _changes_payload(changes: dict[str, FieldChange] | None) -> dict[str, Any] | None:
    if not changes:
        return None
    return {
        key: {"old": json_safe(fc.old), "new": json_safe(fc.new)}
        for key, fc in changes.items()
    }


def _context_payload(context: AuditContext | None) -> dict[str, Any] | None:
    if context is None:
        return None
    return context.model_dump(mode="json", exclude_none=True)


def _build(
    *,
    action: AuditAction,
    result: AuditResult,
    resource_type: str | None,
    resource_id: UUID | None,
    request_id: UUID | None,
    changes: dict[str, FieldChange] | None,
    context: AuditContext | None,
    actor: SessionUser | None,
) -> Any:
    from app.db.models.audit.audit_event import AuditEvent

    if resource_type is not None and not is_known_resource(resource_type):
        msg = f"unknown audit resource_type {resource_type!r}"
        raise ValueError(msg)

    actor_type, actor_id, actor_label, tenant_id = _actor_fields(actor)
    return AuditEvent(
        actor_type=actor_type,
        actor_id=actor_id,
        actor_label=actor_label,
        tenant_id=tenant_id,
        action=action,
        result=result,
        resource_type=resource_type,
        resource_id=resource_id,
        request_id=request_id,
        changes=_changes_payload(changes),
        context=_context_payload(context),
    )


async def emit_committed(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    action: AuditAction,
    result: AuditResult = AuditResult.SUCCESS,
    resource_type: str | None = None,
    resource_id: UUID | None = None,
    request_id: UUID | None = None,
    changes: dict[str, FieldChange] | None = None,
    context: AuditContext | None = None,
    actor: SessionUser | None = None,
) -> None:
    """Record a security event in an independent, separately-committed session.

    Survives a rolled-back / 4xx request — use for auth events.
    """

    event = _build(
        action=action,
        result=result,
        resource_type=resource_type,
        resource_id=resource_id,
        request_id=request_id,
        changes=changes,
        context=context,
        actor=actor,
    )
    async with session_factory() as session:
        session.add(event)
        await session.commit()
