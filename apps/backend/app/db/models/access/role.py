# RBAC role (`dynamic-rbac-roles-permissions`): a tenant-scoped bundle of
# app-function permissions. Replaces the fixed `Role` enum on `users` — a
# user's role is now `users.role_id` → this table. Two `is_system` roles are
# seeded per tenant (`admin` = full catalog incl. patient.accessAll; `default`
# = breakGlass.request only); admins create more. Identity-types
# (patient/caregiver/external) are NOT roles — they are derived from data
# (patient_id / Practitioner row / org-tree).
#
# NB: class name `Role` is the ORM model; the legacy enum `app.core.enums.Role`
# is being removed by this change.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Entity


class Role(Entity):
    # Inherits `Entity` (id + timestamps + soft-delete) NOT `TenantOwnedEntity`:
    # roles carry no created_by/updated_by user FKs. That would create a
    # bootstrap cycle (role.created_by → users, users.role_id → roles) and
    # roles are config, not user-owned. "Who created/changed a role" is
    # captured in `audit_events` via `__audited__`, not a column.
    __tablename__ = "roles"
    __realtime_resource__: ClassVar[str | None] = None
    __audited__: ClassVar[bool] = True
    __table_args__ = (sa.UniqueConstraint("tenant_id", "slug", name="uq_roles_tenant_slug"),)

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    # Seeded, undeletable, admin-only to edit (escalation guard).
    is_system: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.false())
