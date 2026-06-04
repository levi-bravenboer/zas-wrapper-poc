# Break-glass grant (REQ-NON-8): temporary, audited, reason-required access
# to one patient for one caregiver (vervanging / emergency). The grantor is
# `created_by` (audit hook). Derivation emits `Patient#break_glass` tuples for
# open, unexpired, unrevoked grants — included in BOTH `view` and
# `view_shielded` (a substitute clinician needs full sight). The expiry sweep
# (app/services/access/sync/sweep.py) enqueues outbox rows when `expires_at`
# passes so tuples drop without manual action.

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class AccessGrant(TenantOwnedEntity):
    __tablename__ = "access_grants"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.Index(
            "ix_access_grants_active",
            "patient_id",
            "expires_at",
            postgresql_where=sa.text("revoked_at IS NULL"),
        ),
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # persisted verbatim; mandatory (validation rejects empty) — REQ-NON-8
    reason: Mapped[str] = mapped_column(sa.Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
