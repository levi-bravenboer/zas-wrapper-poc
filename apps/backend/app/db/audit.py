"""Session-scoped audit auto-fill.

`install_audit_hooks()` registers a single `Session.before_flush` listener
that reads `session.info[SESSION_ACTOR_KEY]` and stamps `tenant_id` /
`created_by` / `updated_by` (and `updated_by` on dirty rows) on new
`AuditableEntity` / `TenantOwnedEntity` instances when the slot is set.

Entry points wire the slot:

- HTTP: `app.db.engine.get_session` writes the slot from `OptionalCurrentUserDep`
  (introduced in `backend-user-auth-base`).
- Scripts: `scripts._db.script_session(*, actor=None)` writes the slot when supplied.
- Tests: the `session_actor` fixture (default `None`) is read by `db_session`.

The listener is a no-op when the slot is unset. Auditable rows that flush
without an actor get the DB `NOT NULL` violation — by design.
"""

from __future__ import annotations

from typing import Any, Final

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.db.base import AuditableEntity, TenantOwnedEntity

SESSION_ACTOR_KEY: Final[str] = "actor"


def install_audit_hooks() -> None:
    @event.listens_for(Session, "before_flush")
    def _stamp_audit_fields(  # pragma: no cover - exercised via integration paths
        session: Session,
        _flush_context: Any,
        _instances: Any,
    ) -> None:
        actor = session.info.get(SESSION_ACTOR_KEY)
        if actor is None:
            return

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
