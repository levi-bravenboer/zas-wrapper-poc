# Generic document attachment on any owner entity (appointment, task,
# patient). Metadata here; bytes on S3 via presigned URLs. `owner_type` +
# `owner_id` address the owner (no FK); `patient_id` records the subject.
# Uploader-tracked; uploader may soft-delete own.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.collaboration import OwnerType
from app.db.base import TenantOwnedEntity


class Attachment(TenantOwnedEntity):
    __tablename__ = "attachments"
    __realtime_resource__: ClassVar[str | None] = "attachments"
    __audited__: ClassVar[bool] = True
    __table_args__ = (
        sa.Index(
            "ix_attachments_owner_open",
            "owner_type",
            "owner_id",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        sa.Index(
            "ix_attachments_patient_open",
            "patient_id",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
    )

    owner_type: Mapped[OwnerType] = mapped_column(
        sa.Enum(
            OwnerType,
            name="owner_type",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )
    owner_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
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
