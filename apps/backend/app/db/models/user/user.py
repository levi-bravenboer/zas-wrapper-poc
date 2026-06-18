# Self-referential FK invariant: `users.created_by` / `users.updated_by` /
# `users.deleted_by` all FK `users.id` with `ON DELETE RESTRICT` (declared on
# `AuditableEntity` in `app/db/base.py`). The bootstrap admin row breaks the
# FK cycle by self-referencing: `id = created_by = updated_by = ADMIN_USER_ID`.
# That row is the only one inserted with explicit audit columns; every other
# row relies on the `before_flush` audit hook to stamp them from
# `session.info[SESSION_ACTOR_KEY]`.
#
# `dynamic-rbac-roles-permissions`: `role` is no longer an enum — a user row
# points at a `roles` row via `role_id`. Identity-type (patient / caregiver /
# external) is derived from data, not the role: a patient row carries
# `patient_id`; a caregiver has a `Practitioner` row; external is org-tree
# derived. Uniqueness uses partial indexes on the `patient_id` discriminator
# (a human may hold staff rows AND a patient row — same `default` role).

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class User(TenantOwnedEntity):
    __tablename__ = "users"
    __realtime_resource__: ClassVar[str | None] = "users"
    __audited__: ClassVar[bool] = True
    __audit_exclude__: ClassVar[frozenset[str]] = frozenset(
        {"password_hash", "created_by", "updated_by", "deleted_by"}
    )
    __table_args__ = (
        # One staff row per role for a human (patient_id NULL); plus at most
        # one patient row per human (patient_id set). A patient row and a
        # caregiver row both carry the `default` role, distinguished by
        # patient_id (multi-role-login).
        sa.Index(
            "uq_users_tenant_lower_email_role_staff",
            "tenant_id",
            sa.func.lower(sa.column("email")),
            "role_id",
            unique=True,
            postgresql_where=sa.text("patient_id IS NULL"),
        ),
        sa.Index(
            "uq_users_tenant_lower_email_patient",
            "tenant_id",
            sa.func.lower(sa.column("email")),
            unique=True,
            postgresql_where=sa.text("patient_id IS NOT NULL"),
        ),
        sa.Index("ix_users_tenant_id_role_id", "tenant_id", "role_id"),
        # External-subject uniqueness scoped per role (multi-role humans).
        sa.Index(
            "uq_users_tenant_external_subject_role",
            "tenant_id",
            "external_idp",
            "external_subject",
            "role_id",
            unique=True,
            postgresql_where=sa.text("external_subject IS NOT NULL"),
        ),
        # 1:1 patient↔user link via partial unique index.
        sa.Index(
            "uq_users_patient_id",
            "patient_id",
            unique=True,
            postgresql_where=sa.text("patient_id IS NOT NULL"),
        ),
        sa.CheckConstraint(
            "password_hash IS NOT NULL OR external_subject IS NOT NULL",
            name="ck_users_credential_present",
        ),
    )

    # Affiliation lives on `PractitionerRole` rows. A caregiver `User` is
    # 1:1 with a `Practitioner` row (FK on `practitioners.user_id`); that
    # `Practitioner` carries one or more `PractitionerRole` rows. See the
    # `practitioner-role-split` capability spec.
    email: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    external_idp: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    external_subject: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    patient_id: Mapped[UUID | None] = mapped_column(
        sa.Uuid(),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=True,
    )
