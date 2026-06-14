# FHIR R4 `Appointment.participant`. One row per (appointment, user, role).
# v1 freezes the participant set after create — there is no API to mutate
# participants on an existing appointment. To change attendees, callers
# delete + recreate the appointment.
#
# Not an `AuditableEntity`: participant rows piggyback on the appointment's
# audit context. We inherit `Entity` directly (id + timestamps + soft delete)
# and persist `tenant_id` denormalised so the aggregator's participant
# predicate does not need to JOIN `appointments`.
#
# Two partial unique indexes enforce invariants the validator also catches:
# - `uq_appointment_participants_lead_open` — at most one active `lead`.
# - `uq_appointment_participants_user_open` — at most one active row per
#   `(appointment_id, user_id)`.
#
# Supporting index `ix_appointment_participants_user_open` makes the
# aggregator's participant predicate (`user_id = caller AND deleted_at IS NULL`)
# index-only.

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums.appointment import AppointmentParticipantRole
from app.db.base import Entity

if TYPE_CHECKING:
    from app.db.models.appointment.appointment import Appointment


class AppointmentParticipant(Entity):
    __tablename__ = "appointment_participants"
    __realtime_resource__: ClassVar[str | None] = "appointment_participants"
    __table_args__ = (
        sa.Index(
            "uq_appointment_participants_lead_open",
            "appointment_id",
            unique=True,
            postgresql_where=sa.text("role = 'lead' AND deleted_at IS NULL"),
        ),
        sa.Index(
            "uq_appointment_participants_user_open",
            "appointment_id",
            "user_id",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        sa.Index(
            "ix_appointment_participants_user_open",
            "user_id",
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
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    role: Mapped[AppointmentParticipantRole] = mapped_column(
        sa.Enum(
            AppointmentParticipantRole,
            name="appointment_participant_role",
            native_enum=True,
            create_constraint=True,
            values_callable=lambda enum_cls: [m.value for m in enum_cls],
        ),
        nullable=False,
    )

    appointment: Mapped[Appointment] = relationship("Appointment", back_populates="participants")
