# Self-referential FK invariant: `users.created_by` / `users.updated_by` /
# `users.deleted_by` all FK `users.id` with `ON DELETE RESTRICT` (declared on
# `AuditableEntity` in `app/db/base.py`). The bootstrap admin row breaks the
# FK cycle by self-referencing: `id = created_by = updated_by = ADMIN_USER_ID`.
# That row is the only one inserted with explicit audit columns; every other
# row relies on the `before_flush` audit hook to stamp them from
# `session.info[SESSION_ACTOR_KEY]`.

from __future__ import annotations

import sqlalchemy as sa
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
