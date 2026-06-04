# Transactional outbox for the Keto tuple pipeline. Rows name an OBJECT to
# reconcile, not a tuple operation: the relay re-derives the object's
# expected tuples from Postgres (`access/sync/derive.py`) and converges
# Keto, so processing is idempotent and crash-safe by construction.
# Infrastructure table: no tenant scope, no audit columns, no soft-delete.

from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuthzOutbox(Base):
    __tablename__ = "authz_outbox"
    __table_args__ = (
        sa.Index(
            "ix_authz_outbox_pending",
            "id",
            postgresql_where=sa.text("processed_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(sa.BigInteger, sa.Identity(), primary_key=True)
    namespace: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    object_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
