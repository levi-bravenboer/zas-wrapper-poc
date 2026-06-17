"""Semantic audit events for care pathway authoring + access changes.

Pathway models are deliberately NOT `__audited__` (no row-level auto-diff). The
authoring lifecycle is captured here as explicit domain events, emitted in-band
(`record_in_session`) so each event commits with — and only with — the mutation
it describes. Every event anchors to the Pathway (`resource_type = "Pathway"`,
`resource_id = pathway_id`) with version/operation details in `context`, so one
indexed query returns a care path's full history.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.audit import AuditAction
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.audit.audit_event import AuditEvent
from app.services.audit.emit import record_in_session

PATHWAY_RESOURCE_TYPE = "Pathway"

# `context.operation` discriminators. The `action` verb stays generic
# (created / updated / deleted / published); the specific authoring or access
# operation lives here for display.
OP_CREATE = "create"
OP_EDIT = "edit"
OP_DUPLICATE = "duplicate"
OP_RESTORE = "restore"
OP_FORK = "fork"
OP_DELETE = "delete"
OP_SCOPE_SPECIALISMS = "scope_specialisms"
OP_ASSIGN_PRACTITIONERS = "assign_practitioners"

# One `edited` event per editing session. The builder autosaves on an ~800ms
# debounce, so a session emits many `replace_definition` calls; we suppress all
# but the first while the most recent event is an edit by the same actor within
# this quiet window.
EDIT_COALESCE_WINDOW = timedelta(minutes=15)


def record_pathway_event(
    session: AsyncSession,
    *,
    action: AuditAction,
    pathway_id: UUID,
    event_code: str | None = None,
    operation: str | None = None,
    context: dict[str, Any] | None = None,
) -> Any:
    """Emit a pathway audit event anchored to `pathway_id`."""

    return record_in_session(
        session,
        action=action,
        resource_type=PATHWAY_RESOURCE_TYPE,
        resource_id=pathway_id,
        event_code=event_code,
        operation=operation,
        context=context,
    )


async def edit_starts_new_session(
    session: AsyncSession,
    *,
    pathway_id: UUID,
    now: datetime | None = None,
    window: timedelta = EDIT_COALESCE_WINDOW,
) -> bool:
    """Whether a draft save should emit a fresh `edited` event.

    Returns False (suppress) ONLY when the most recent event for this pathway is
    itself an `edited` event by the same actor within `window`. Returns True
    (emit) when there is no prior event, the window has elapsed, a different
    actor edits, or a lifecycle event intervened (the most-recent event is not
    an edit).
    """

    actor = session.info.get(SESSION_ACTOR_KEY)
    actor_id = getattr(actor, "id", None)
    now = now or datetime.now(timezone.utc)

    latest = await session.scalar(
        select(AuditEvent)
        .where(
            AuditEvent.resource_type == PATHWAY_RESOURCE_TYPE,
            AuditEvent.resource_id == pathway_id,
        )
        .order_by(AuditEvent.created_at.desc())
        .limit(1)
    )
    if latest is None:
        return True
    is_edit = (
        latest.action == AuditAction.UPDATED and (latest.context or {}).get("operation") == OP_EDIT
    )
    if not is_edit or latest.actor_id != actor_id:
        return True
    return (now - latest.created_at) >= window
