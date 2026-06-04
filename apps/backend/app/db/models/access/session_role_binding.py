# Session → active-role binding (REQ-NON-3, REQ-FUN-4). One human (one
# Kratos identity) may map to several `users` rows (one per role); the
# binding records WHICH row a given Kratos session acts as. Written at login
# (automatic for single-row rosters, after explicit choice otherwise);
# rewritten on role switch (audited at the service layer). Revoking the
# Kratos session orphans the row — whoami fails first, so the binding is
# dead weight swept lazily, never consulted.
#
# Plain `Base` table (like AuthzOutbox): keyed by the Kratos session id, no
# tenant/audit columns — the bound user row carries both.

from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SessionRoleBinding(Base):
    __tablename__ = "session_role_bindings"

    kratos_session_id: Mapped[str] = mapped_column(sa.String(64), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bound_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )
