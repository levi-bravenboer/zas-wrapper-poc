"""SQLAlchemy declarative root and shared abstract bases.

Every concrete model picks one base from the hierarchy:

- `Entity`              — id + created_at + updated_at + deleted_at (soft delete).
                          Used by root rows (`Tenant`) and rows that are not
                          tenant-scoped.
- `AuditableEntity`     — adds `created_by` / `updated_by` / `deleted_by` user FKs
                          (FK `users.id`, ON DELETE RESTRICT). Bootstrap admin
                          self-references the audit FKs on insert.
- `TenantOwnedEntity`   — adds non-null `tenant_id` FK. Used by every row owned
                          by a hospital (`User`, `Pathway`, `Patient`, `Task`, ...).
                          Inherits `AuditableEntity`, so tenant-owned rows are
                          auditable by construction.

`Tenant` inherits `Entity` only — it is the root scoping row, and a `users`
row to FK against does not exist when the bootstrap tenant is seeded.

Soft delete: `deleted_at IS NOT NULL` marks a row as logically removed.
`BaseRepository.list()` filters them out by default; opt in via
`list_including_deleted()`. Custom repo queries MUST add the same predicate
unless intentionally including deleted rows — see `app/repositories/base.py`.

Audit auto-fill: `app/db/audit.install_audit_hooks()` registers a session-level
`before_flush` listener that stamps `tenant_id` / `created_by` / `updated_by`
on new auditable rows (and `updated_by` on dirty ones) from
`session.info[SESSION_ACTOR_KEY]`. Entry points (HTTP `get_session`, script
`script_session(actor=)`, test `session_actor` fixture) write the slot.
"""

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative root. Alembic autogenerate diffs against this."""


class Entity(Base):
    """Universal abstract base: id + timestamps + soft delete.

    `__realtime_resource__` opts a model into the realtime invalidation
    channel (`app.realtime.flush_hook`). `None` means "do not publish".
    Subclasses MUST declare it explicitly in the class body (no implicit
    inheritance) — enforced by `tests/_conformance/test_realtime_resource_declared.py`.
    """

    __abstract__ = True
    __realtime_resource__: ClassVar[str | None] = None

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=True,
        default=None,
    )


class AuditableEntity(Entity):
    """Adds `created_by` / `updated_by` / `deleted_by` user FKs.

    `created_by` and `updated_by` are NOT NULL — the bootstrap admin row
    self-references both on insert to break the FK cycle. Every other row
    relies on the `before_flush` audit hook (`app/db/audit.py`) to stamp the
    fields from `session.info[SESSION_ACTOR_KEY]`.
    """

    __abstract__ = True

    created_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    updated_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    deleted_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )


class TenantOwnedEntity(AuditableEntity):
    """Adds non-null `tenant_id` FK with ON DELETE RESTRICT.

    Tenant drops never cascade — PHI removal goes through an explicit
    archive flow, not foreign-key cascade.
    """

    __abstract__ = True

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
