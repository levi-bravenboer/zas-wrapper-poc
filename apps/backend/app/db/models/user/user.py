# Self-referential FK invariant: `users.created_by` / `users.updated_by` /
# `users.deleted_by` all FK `users.id` with `ON DELETE RESTRICT` (declared on
# `AuditableEntity` in `app/db/base.py`). The bootstrap admin row breaks the
# FK cycle by self-referencing: `id = created_by = updated_by = ADMIN_USER_ID`.
# That row is the only one inserted with explicit audit columns; every other
# row relies on the `before_flush` audit hook to stamp them from
# `session.info[SESSION_ACTOR_KEY]`.

from __future__ import annotations

from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.user import Role
from app.db.base import TenantOwnedEntity


class User(TenantOwnedEntity):
    __tablename__ = "users"
    __table_args__ = (
        sa.Index(
            "uq_users_tenant_id_lower_email",
            "tenant_id",
            sa.func.lower(sa.column("email")),
            unique=True,
        ),
        sa.Index("ix_users_tenant_id_role", "tenant_id", "role"),
    )

    # Nullable at DB level to break the bootstrap chicken-and-egg cycle:
    # `users.organisation_id` → organisations.id, and
    # `organisations.created_by` → users.id (via AuditableEntity) are both
    # NOT NULL. The bootstrap admin row is inserted with `organisation_id=NULL`
    # so `seed_organisations` can run next and stamp `created_by=admin.id`;
    # the seed then back-fills `admin.organisation_id` to the root org.
    # Non-bootstrap rows MUST set this — enforced by the user service layer.
    organisation_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        # `use_alter=True` defers FK creation past the initial table emit so
        # `Base.metadata.create_all` (used by the test bootstrap) can resolve
        # the users ↔ organisations cycle introduced by `AuditableEntity`'s
        # `created_by` / `updated_by` FKs to `users.id`.
        sa.ForeignKey(
            "organisations.id",
            ondelete="RESTRICT",
            use_alter=True,
            name="fk_users_organisation_id_organisations",
        ),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(sa.String(255), nullable=False)
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
