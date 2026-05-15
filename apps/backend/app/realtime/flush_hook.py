"""SQLAlchemy session hook turning row mutations into realtime events.

Wiring:
- `before_flush`: collect `(resource, action, row_id, tenant_id)` from
  `session.new | session.dirty | session.deleted`. We rely on
  `inspect(obj).attrs.deleted_at.history` to tell a soft-delete from any
  other update.
- `after_commit`: publish every collected event via the process-global
  `RealtimePubSub` (resolved lazily at publish time so tests can swap it).
- `after_rollback`: drop the collected events — they never happened.

Models opt in by setting `__realtime_resource__: ClassVar[str] = "<name>"`
on the class. Models with `None` (the default) emit no events.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Final
from uuid import UUID

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.db.base import Entity, TenantOwnedEntity
from app.realtime.events import RealtimeEvent
from app.realtime.pubsub import get_pubsub

_PENDING_KEY: Final[str] = "_realtime_pending"
_INSTALLED: bool = False


@dataclass(frozen=True)
class _Pending:
    tenant_id: UUID
    event: RealtimeEvent


def _resource_for(obj: object) -> str | None:
    if not isinstance(obj, Entity):
        return None
    return obj.__class__.__realtime_resource__


def _tenant_id_for(obj: object) -> UUID | None:
    if isinstance(obj, TenantOwnedEntity):
        return obj.tenant_id
    return None


def _is_soft_delete(obj: Entity) -> bool:
    """`deleted_at` transitioned from `None` to a value during this flush."""
    inspector = inspect(obj)
    try:
        history = inspector.attrs.deleted_at.history
    except AttributeError:
        return False
    return history.has_changes() and obj.deleted_at is not None


def _collect_pending(session: Session) -> list[_Pending]:
    pending: list[_Pending] = []

    sources: Iterable[tuple[Iterable[Any], str]] = (
        (session.new, "upsert"),
        (session.dirty, "upsert"),
        (session.deleted, "delete"),
    )
    for objects, default_action in sources:
        for obj in objects:
            resource = _resource_for(obj)
            if resource is None:
                continue
            tenant_id = _tenant_id_for(obj)
            if tenant_id is None:
                continue
            action = "delete" if default_action == "delete" else "upsert"
            if default_action == "upsert" and isinstance(obj, Entity) and _is_soft_delete(obj):
                action = "upsert"
            row_id = getattr(obj, "id", None)
            pending.append(
                _Pending(
                    tenant_id=tenant_id,
                    event=RealtimeEvent(
                        resource=resource,
                        action=action,  # type: ignore[arg-type]
                        id=str(row_id) if row_id is not None else None,
                    ),
                )
            )
    return pending


def install_realtime_flush_hook() -> None:
    """Install the session-level hook. Idempotent — subsequent calls no-op.

    The pub/sub instance is resolved lazily at publish time via
    `get_pubsub()`, so tests can swap the global via
    `set_pubsub_for_tests()`.
    """
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True

    @event.listens_for(Session, "before_flush")
    def _before_flush(session: Session, _ctx: Any, _instances: Any) -> None:
        existing: list[_Pending] = list(session.info.get(_PENDING_KEY, ()))
        existing.extend(_collect_pending(session))
        session.info[_PENDING_KEY] = existing

    @event.listens_for(Session, "after_commit")
    def _after_commit(session: Session) -> None:
        items: list[_Pending] = session.info.pop(_PENDING_KEY, [])
        bus = get_pubsub()
        for item in items:
            bus.publish(item.tenant_id, item.event)

    @event.listens_for(Session, "after_rollback")
    def _after_rollback(session: Session) -> None:
        session.info.pop(_PENDING_KEY, None)

    @event.listens_for(Session, "after_soft_rollback")
    def _after_soft_rollback(session: Session, _previous_transaction: Any) -> None:
        del session
