# Append-only, attributed note on an appointment. Anyone with visibility of
# the appointment (internal staff + external grant-holders) may add one; each
# note records its author + creation time. No edit/delete at this tier.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class AppointmentNote(TenantOwnedEntity):
    __tablename__ = "appointment_notes"
    __realtime_resource__: ClassVar[str | None] = "appointment_notes"
    __audited__: ClassVar[bool] = True
    __table_args__ = (
        sa.Index(
            "ix_appointment_notes_appointment_open",
            "appointment_id",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
    )

    appointment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(sa.Text(), nullable=False)
