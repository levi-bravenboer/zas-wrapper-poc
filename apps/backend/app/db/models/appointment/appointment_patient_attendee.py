# A patient attending an appointment whose subject (`appointments.patient_id`)
# is a different patient. This distinguishes appointments *about* a patient
# (subject) from appointments *with* a patient (attendee) on the patient
# profile. Like `AppointmentParticipant`, this is a thin link row that
# piggybacks on the appointment's audit context — `Entity` (not auditable)
# with a denormalised `tenant_id` so patient-keyed queries need no join.

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Entity

if TYPE_CHECKING:
    from app.db.models.appointment.appointment import Appointment


class AppointmentPatientAttendee(Entity):
    __tablename__ = "appointment_patient_attendees"
    __realtime_resource__: ClassVar[str | None] = "appointment_patient_attendees"
    __table_args__ = (
        sa.Index(
            "uq_appointment_patient_attendees_open",
            "appointment_id",
            "patient_id",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        sa.Index(
            "ix_appointment_patient_attendees_patient_open",
            "patient_id",
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
    )

    tenant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    appointment_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    appointment: Mapped[Appointment] = relationship("Appointment")
