# Append-only audit trail. One row per audited event across three feeds:
# automatic data-change diffs (the `before_flush` hook in `app.db.audit`),
# explicit domain events, and authentication events (both via
# `app.services.audit.emit`).
#
# Inherits `Base` directly — NOT `Entity` — so it carries `id` + `created_at`
# only. No `updated_at`, no `deleted_at`, no soft-delete: immutability is
# structural. Consequently it is not an `AuditableEntity`, so the audit hook
# never stamps or recurses on it.
#
# `tenant_id` / `actor_id` are denormalised with NO foreign keys — the trail
# must outlive tenant archival and user deletion. `actor_label` denormalises
# the actor display name so a row stays legible after rename/delete.
#
# `action` is the operation VERB (`AuditAction`); the noun lives in free-text
# `resource_type`. `result` is the orthogonal outcome. `request_id` is a
# first-class indexed column for correlating audit rows with request logs.

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.audit import ActorType, AuditAction, AuditResult
from app.db.base import Base

_ENUM = dict(
    native_enum=True,
    create_constraint=True,
    values_callable=lambda enum_cls: [m.value for m in enum_cls],
)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        sa.Index(
            "ix_audit_events_resource",
            "resource_type",
            "resource_id",
            sa.text("created_at DESC"),
        ),
        sa.Index("ix_audit_events_actor", "actor_id", sa.text("created_at DESC")),
        sa.Index("ix_audit_events_tenant", "tenant_id", sa.text("created_at DESC")),
        sa.Index(
            "ix_audit_events_action_result",
            "action",
            "result",
            sa.text("created_at DESC"),
        ),
        sa.Index("ix_audit_events_request", "request_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    actor_type: Mapped[ActorType] = mapped_column(
        sa.Enum(ActorType, name="actor_type", **_ENUM),
        nullable=False,
    )
    actor_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    actor_label: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    tenant_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    action: Mapped[AuditAction] = mapped_column(
        sa.Enum(AuditAction, name="audit_action", **_ENUM),
        nullable=False,
    )
    result: Mapped[AuditResult] = mapped_column(
        sa.Enum(AuditResult, name="audit_result", **_ENUM),
        nullable=False,
        server_default=sa.text("'success'"),
    )

    resource_type: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    resource_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    request_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    context: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
