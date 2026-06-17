# FHIR R4 `Appointment` (subset). One row per scheduled clinical event for
# exactly one patient. PoC tracks `title`, `kind`, `starts_at`, `ends_at`,
# `modality`, `location_text`, and the FHIR-aligned `status` enum; we skip
# `serviceType`, `appointmentType`, `priority`, `serviceCategory`, and
# `requestedPeriod` until MVP demands them. `kind` is a domain enum
# translated to FHIR `serviceType` coding only at the HiX adapter boundary.
#
# `pathway_block_instance_id` is reserved for the future pathway runtime —
# `UUID NULL` with NO FOREIGN KEY in v1, so we do not need conditional
# alembic logic against a table that does not exist yet. A follow-up
# migration adds the `ON DELETE SET NULL` FK when `pathway_block_instances`
# lands.
#
# Participants are persisted in `appointment_participants`. The relationship
# is `selectin` so callers fetch all rows in a second query (Patient.identifiers
# pattern). The aggregator at `/tasks` does its own JOIN for projection and
# does not hit the ORM relationship.
#
# `CHECK (ends_at > starts_at)` is defence-in-depth — `AppointmentValidator`
# enforces the same rule at write time. The partial unique index on
# `appointment_participants` enforces exactly one active `lead`.

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentStatus,
)
from app.db.base import TenantOwnedEntity

if TYPE_CHECKING:
    from app.db.models.appointment.appointment_participant import (
        AppointmentParticipant,
    )


class Appointment(TenantOwnedEntity):
    __tablename__ = "appointments"
    __realtime_resource__: ClassVar[str | None] = "appointments"
    __audited__: ClassVar[bool] = True
    __table_args__ = (
        sa.CheckConstraint("ends_at > starts_at", name="ck_appointments_ends_after_starts"),
        sa.Index(
            "ix_appointments_patient_booked_starts_at",
            "tenant_id",
            "patient_id",
            "starts_at",
            postgresql_where=sa.text("status = 'booked' AND deleted_at IS NULL"),
        ),
    )

    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    pathway_block_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text(), nullable=True)
    kind: Mapped[AppointmentKind] = mapped_column(
        sa.Enum(
            AppointmentKind,
            name="appointment_kind",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )
    starts_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
    )
    ends_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
    )
    modality: Mapped[AppointmentModality] = mapped_column(
        sa.Enum(
            AppointmentModality,
            name="appointment_modality",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )
    location_text: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    status: Mapped[AppointmentStatus] = mapped_column(
        sa.Enum(
            AppointmentStatus,
            name="appointment_status",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
        server_default=sa.text("'booked'"),
    )

    participants: Mapped[list[AppointmentParticipant]] = relationship(
        "AppointmentParticipant",
        back_populates="appointment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
