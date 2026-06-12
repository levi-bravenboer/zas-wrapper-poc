# Helper for building valid `Appointment` + `AppointmentParticipant` rows
# through the `AppointmentValidator`. Used by tasks-base aggregator tests
# and any future appointment-domain test that needs sample rows.
#
# The validator is IO-free — it takes pre-resolved tenant ids. This helper
# is the thin wrapper that resolves those (caller supplies the related
# rows) and then persists via the ORM session.

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.db.models.appointment import Appointment, AppointmentParticipant
from app.db.models.patient import Patient
from app.db.models.user import User
from app.domain.appointment import (
    AppointmentParticipantSpec,
    AppointmentSpec,
    AppointmentValidator,
)


async def make_appointment(
    session: AsyncSession,
    *,
    tenant_id: UUID,
    patient: Patient,
    actor: User,
    participants: Sequence[tuple[User, AppointmentParticipantRole]],
    title: str = "Test appointment",
    kind: AppointmentKind = AppointmentKind.CONSULTATION,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    modality: AppointmentModality = AppointmentModality.ONLINE,
    location_text: str | None = None,
    status: AppointmentStatus = AppointmentStatus.BOOKED,
) -> Appointment:
    """Validate + persist an appointment with its participants.

    Defaults to a `booked`, `online`, 1-hour appointment 1 day in the future
    so it lands inside the `/tasks` aggregator's 30-day window for the
    happy-path tests.
    """

    if starts_at is None:
        starts_at = datetime.now(UTC) + timedelta(days=1)
    if ends_at is None:
        ends_at = starts_at + timedelta(hours=1)

    spec = AppointmentSpec(
        tenant_id=tenant_id,
        patient_id=patient.id,
        patient_tenant_id=patient.tenant_id,
        title=title,
        kind=kind,
        starts_at=starts_at,
        ends_at=ends_at,
        modality=modality,
        location_text=location_text,
        status=status,
        participants=tuple(
            AppointmentParticipantSpec(
                user_id=user.id,
                role=role,
                user_tenant_id=user.tenant_id,
            )
            for user, role in participants
        ),
    )
    AppointmentValidator.validate(spec)

    appointment = Appointment(
        id=uuid4(),
        tenant_id=tenant_id,
        created_by=actor.id,
        updated_by=actor.id,
        patient_id=patient.id,
        title=title,
        kind=kind,
        starts_at=starts_at,
        ends_at=ends_at,
        modality=modality,
        location_text=location_text,
        status=status,
    )
    session.add(appointment)
    await session.flush()

    for user, role in participants:
        session.add(
            AppointmentParticipant(
                tenant_id=tenant_id,
                appointment_id=appointment.id,
                user_id=user.id,
                role=role,
            )
        )
    await session.flush()
    return appointment
