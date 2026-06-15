"""Session-scoped audit auto-fill + append-only data-change capture.

`install_audit_hooks()` registers a single `Session.before_flush` listener
that does two things from `session.info[SESSION_ACTOR_KEY]`:

1. **Stamp** `tenant_id` / `created_by` / `updated_by` (and `updated_by` on
   dirty rows) on new `AuditableEntity` / `TenantOwnedEntity` instances when
   the actor slot is set. No-op when unset (auditable rows then hit the DB
   `NOT NULL` violation — by design).
2. **Capture** an append-only `AuditEvent` row for every create / update /
   delete of a model that opts in with `__audited__ = True` (see
   `app.db.base.Entity`). The events are `session.add()`-ed inside the same
   flush, so they commit in the same transaction as the change. `AuditEvent`
   itself is not `__audited__`, so capture never recurses.

Entry points wire the actor slot:

- HTTP: `app.db.engine.get_session` writes the slot from `OptionalCurrentUserDep`.
- Scripts: `scripts._db.script_session(*, actor=None)` writes the slot when supplied.
- Tests: the `session_actor` fixture (default `None`) is read by `db_session`.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Final
from uuid import UUID, uuid4

from sqlalchemy import event, inspect as sa_inspect
from sqlalchemy.orm import Session

from app.core.enums.audit import ActorType, AuditAction, AuditResult
from app.db.base import AuditableEntity, Base, Entity, TenantOwnedEntity
from app.services.audit.serialize import json_safe

SESSION_ACTOR_KEY: Final[str] = "actor"

_ALWAYS_EXCLUDED: Final[frozenset[str]] = frozenset({"updated_at"})


@lru_cache(maxsize=1)
def _any_audited_models() -> bool:
    return any(getattr(m.class_, "__audited__", False) for m in Base.registry.mappers)

_HOOKS_INSTALLED = False


def install_audit_hooks() -> None:
    # The listener attaches to the global `Session` class, so it must register
    # exactly once per process — otherwise (e.g. multiple app constructions in
    # tests) it stacks and emits duplicate AuditEvent rows. Stamping is
    # idempotent, but capture is not.
    global _HOOKS_INSTALLED
    if _HOOKS_INSTALLED:
        return
    _HOOKS_INSTALLED = True

    @event.listens_for(Session, "before_flush")
    def _audit_before_flush(  # pragma: no cover - exercised via integration paths
        session: Session,
        _flush_context: Any,
        _instances: Any,
    ) -> None:
        actor = session.info.get(SESSION_ACTOR_KEY)
        if actor is not None:
            _stamp(session, actor)
        _capture(session, actor)


def _stamp(session: Session, actor: Any) -> None:
    actor_id = actor.id
    actor_tenant_id = getattr(actor, "tenant_id", None)

    for obj in session.new:
        if (
            isinstance(obj, TenantOwnedEntity)
            and obj.tenant_id is None
            and actor_tenant_id is not None
        ):
            obj.tenant_id = actor_tenant_id
        if isinstance(obj, AuditableEntity):
            if obj.created_by is None:
                obj.created_by = actor_id
            if obj.updated_by is None:
                obj.updated_by = actor_id

    for obj in session.dirty:
        if isinstance(obj, AuditableEntity) and session.is_modified(
            obj, include_collections=False
        ):
            obj.updated_by = actor_id


def _capture(session: Session, actor: Any) -> None:
    if not _any_audited_models():
        return

    from app.db.models.audit.audit_event import AuditEvent

    actor_type = ActorType.USER if actor is not None else ActorType.SYSTEM
    actor_id: UUID | None = actor.id if actor is not None else None
    actor_label = getattr(actor, "display_name", None) if actor is not None else None
    actor_tenant_id = getattr(actor, "tenant_id", None) if actor is not None else None

    events: list[AuditEvent] = []

    def _tenant_of(obj: Entity) -> UUID | None:
        if isinstance(obj, TenantOwnedEntity):
            return obj.tenant_id
        return actor_tenant_id

    def _new(obj: Entity, action: AuditAction, changes: dict[str, Any] | None) -> AuditEvent:
        # `id` carries a client-side `default=uuid4` that SQLAlchemy only
        # applies during the INSERT (after this hook). Materialise it now so a
        # freshly-created row's `resource_id` is the same UUID it persists with.
        if obj.id is None:
            obj.id = uuid4()
        return AuditEvent(
            actor_type=actor_type,
            actor_id=actor_id,
            actor_label=actor_label,
            tenant_id=_tenant_of(obj),
            action=action,
            result=AuditResult.SUCCESS,
            resource_type=type(obj).__name__,
            resource_id=obj.id,
            changes=changes,
        )

    for obj in session.new:
        if _is_audited(obj):
            events.append(_new(obj, AuditAction.CREATED, _snapshot(obj)))

    for obj in session.dirty:
        if not _is_audited(obj) or not session.is_modified(obj, include_collections=False):
            continue
        diff = _diff(obj)
        if not diff:
            continue
        action = AuditAction.DELETED if _is_soft_delete(diff) else AuditAction.UPDATED
        events.append(_new(obj, action, diff))

    for obj in session.deleted:
        if _is_audited(obj):
            events.append(_new(obj, AuditAction.DELETED, None))

    session.add_all(events)


def _is_audited(obj: object) -> bool:
    return isinstance(obj, Entity) and getattr(type(obj), "__audited__", False)


def _excluded(obj: Entity) -> frozenset[str]:
    return _ALWAYS_EXCLUDED | getattr(type(obj), "__audit_exclude__", frozenset())


def _snapshot(obj: Entity) -> dict[str, Any]:
    excluded = _excluded(obj)
    out: dict[str, Any] = {}
    for attr in sa_inspect(obj).mapper.column_attrs:
        if attr.key in excluded:
            continue
        value = getattr(obj, attr.key)
        if value is not None:
            out[attr.key] = {"old": None, "new": json_safe(value)}
    return out


def _diff(obj: Entity) -> dict[str, Any]:
    excluded = _excluded(obj)
    state = sa_inspect(obj)
    out: dict[str, Any] = {}
    for attr in state.mapper.column_attrs:
        if attr.key in excluded:
            continue
        hist = state.attrs[attr.key].history
        if not hist.has_changes():
            continue
        old = hist.deleted[0] if hist.deleted else None
        new = hist.added[0] if hist.added else None
        out[attr.key] = {"old": json_safe(old), "new": json_safe(new)}
    return out


def _is_soft_delete(diff: dict[str, Any]) -> bool:
    change = diff.get("deleted_at")
    return bool(change) and change.get("old") is None and change.get("new") is not None
