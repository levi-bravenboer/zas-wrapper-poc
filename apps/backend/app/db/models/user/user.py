# Self-referential FK invariant: `users.created_by` / `users.updated_by` /
# `users.deleted_by` all FK `users.id` with `ON DELETE RESTRICT` (declared on
# `AuditableEntity` in `app/db/base.py`). The bootstrap admin row breaks the
# FK cycle by self-referencing: `id = created_by = updated_by = ADMIN_USER_ID`.
# That row is the only one inserted with explicit audit columns; every other
# row relies on the `before_flush` audit hook to stamp them from
# `session.info[SESSION_ACTOR_KEY]`.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.user import Role
from app.db.base import TenantOwnedEntity


class User(TenantOwnedEntity):
    __tablename__ = "users"
    __realtime_resource__: ClassVar[str | None] = "users"
    __table_args__ = (
        # Email uniqueness scoped to (tenant, lower(email), role) so a
        # caregiver and a patient in the same tenant may share an email.
        # Tightening to two-column was the pre-`mobile-app-auth-setup` rule.
        sa.Index(
            "uq_users_tenant_id_lower_email_role",
            "tenant_id",
            sa.func.lower(sa.column("email")),
            "role",
            unique=True,
        ),
        sa.Index("ix_users_tenant_id_role", "tenant_id", "role"),
        # Multi-role humans (access-entitlements): one Kratos identity maps
        # to several rows — one per role — so external-subject uniqueness is
        # scoped per role, mirroring the email rule above.
        sa.Index(
            "uq_users_tenant_external_subject_role",
            "tenant_id",
            "external_idp",
            "external_subject",
            "role",
            unique=True,
            postgresql_where=sa.text("external_subject IS NOT NULL"),
        ),
        # 1:1 patient↔user link via partial unique index; caregivers (NULL
        # `patient_id`) are not constrained.
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
        # FHIR-aligned identity model: a `users` row with `role = 'patient'`
        # references a single `patients` row; non-patient rows MUST NOT
        # carry a `patient_id`. The `patients` table itself carries no
        # credential columns (see `patients-base` spec).
        sa.CheckConstraint(
            "(role = 'patient' AND patient_id IS NOT NULL)"
            " OR (role <> 'patient' AND patient_id IS NULL)",
            name="ck_users_role_patient_link",
        ),
    )

    # Affiliation lives on `PractitionerRole` rows. A caregiver `User` is
    # 1:1 with a `Practitioner` row (FK on `practitioners.user_id`); that
    # `Practitioner` carries one or more `PractitionerRole` rows. See the
    # `practitioner-role-split` capability spec.
    email: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    role: Mapped[Role] = mapped_column(
        sa.Enum(
            Role,
            name="role",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    external_idp: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    external_subject: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    patient_id: Mapped[UUID | None] = mapped_column(
        sa.Uuid(),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=True,
    )
