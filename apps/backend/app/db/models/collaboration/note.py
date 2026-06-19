# Generic activity entry attached to any owner entity (appointment, task,
# patient). `owner_type` + `owner_id` address the owner (no FK — polymorphic);
# `patient_id` records the patient it concerns so a patient view can aggregate
# everything. A note carries text (`body`) and/or a file (`storage_key` + file
# metadata) — a file is just a note with a file. Authored + attributed.

from __future__ import annotations

from typing import ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums.collaboration import OwnerType
from app.db.base import TenantOwnedEntity


class Note(TenantOwnedEntity):
    __tablename__ = "notes"
    __realtime_resource__: ClassVar[str | None] = "notes"
    __audited__: ClassVar[bool] = True
    __table_args__ = (
        sa.Index(
            "ix_notes_owner_open",
            "owner_type",
            "owner_id",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        sa.Index(
            "ix_notes_patient_open",
            "patient_id",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        # A note must carry text or a file (or both) — never empty.
        sa.CheckConstraint(
            "body IS NOT NULL OR storage_key IS NOT NULL",
            name="ck_notes_body_or_file",
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
    # Nullable: a note's owner (e.g. a task) need not be linked to a patient.
    # When set, the patient view can aggregate everything about that patient.
    patient_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    author_user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # Text content. Nullable: a file-only note has no body.
    body: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    # File payload (optional). Present together when the note carries a file;
    # bytes live on S3 via presigned URLs.
    filename: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    size: Mapped[int | None] = mapped_column(sa.Integer(), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(sa.String(512), nullable=True, unique=True)
