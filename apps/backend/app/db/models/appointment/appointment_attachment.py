# A document attached to an appointment. Metadata lives here; bytes live in
# S3-compatible object storage at `storage_key` (uploaded/downloaded via
# presigned URLs, never through the API). Uploader-tracked; uploader may
# soft-delete their own.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TenantOwnedEntity


class AppointmentAttachment(TenantOwnedEntity):
    __tablename__ = "appointment_attachments"
    __realtime_resource__: ClassVar[str | None] = "appointment_attachments"
    __audited__: ClassVar[bool] = True
    __table_args__ = (
        sa.Index(
            "ix_appointment_attachments_appointment_open",
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
    uploaded_by: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    size: Mapped[int] = mapped_column(sa.Integer(), nullable=False)
    storage_key: Mapped[str] = mapped_column(sa.String(512), nullable=False, unique=True)
