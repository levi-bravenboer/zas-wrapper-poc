# `appointment` source projection for the `/tasks` aggregator.
#
# Per design.md:
# - D-AGG: aggregator is a projection over source rows; no `tasks` table.
# - D-WINDOW: v1 surfaces `status='booked' AND starts_at IN [now, now+30d]`.
# - D-PART: visibility is participant-driven — caller must have an active
#   `appointment_participants` row (any role) for the appointment to surface.
#   Admins use the same predicate as caregivers; no tenant-wide bypass.
# - Tenant scope: appointments belong to the caller's tenant.
#
# Query plan: SELECT appointments JOIN appointment_participants ON the
# caller's user_id (with active deleted_at IS NULL). The patient inline
# summary and participants list are resolved by separate queries keyed by
# the matched appointment ids, then assembled into `TaskItem`. INSZ is
# resolved through the same `patient_identifiers` query the patient API
# uses (`urn:oid:...` for the Belgian eHealth INSZ system).

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Final
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.identifiers import INSZ_SYSTEM
from app.db.models.appointment import Appointment, AppointmentParticipant
from app.db.models.patient import Patient
from app.db.models.patient.patient_identifier import PatientIdentifier
from app.db.models.user import User
from app.schemas._list.page import Page
from app.schemas.appointment.appointment import AppointmentParticipantInlineSummary
from app.schemas.auth.auth import SessionUser
from app.schemas.patient.patient import PatientInlineSummary
from app.schemas.task.task_item import AppointmentPayload, TaskItem

SOURCE_NAME: Final[str] = "appointment"
WINDOW_DAYS: Final[int] = 30


def _now() -> datetime:
    return datetime.now(UTC)


def _window_bounds() -> tuple[datetime, datetime]:
    now = _now()
    return now, now + timedelta(days=WINDOW_DAYS)


def _base_predicate(caller: SessionUser, start: datetime, end: datetime) -> tuple:  # type: ignore[type-arg]
    """Predicate clauses shared between list/get/count."""

    return (
        Appointment.tenant_id == caller.tenant_id,
        Appointment.deleted_at.is_(None),
        Appointment.status == "booked",
        Appointment.starts_at >= start,
        Appointment.starts_at <= end,
        AppointmentParticipant.user_id == caller.id,
        AppointmentParticipant.deleted_at.is_(None),
        AppointmentParticipant.tenant_id == caller.tenant_id,
    )


async def _resolve_patient_summaries(
    session: AsyncSession, patient_ids: list[UUID]
) -> dict[UUID, PatientInlineSummary]:
    if not patient_ids:
        return {}

    patient_rows = (
        await session.execute(
            select(
                Patient.id,
                Patient.family_name,
                Patient.given_name,
                Patient.primary_organisation_id,
            ).where(Patient.id.in_(patient_ids))
        )
    ).all()

    insz_rows = (
        await session.execute(
            select(PatientIdentifier.patient_id, PatientIdentifier.value).where(
                PatientIdentifier.patient_id.in_(patient_ids),
                PatientIdentifier.system == INSZ_SYSTEM,
                PatientIdentifier.deleted_at.is_(None),
            )
        )
    ).all()
    insz_by_patient = {patient_id: value for patient_id, value in insz_rows}

    return {
        row.id: PatientInlineSummary(
            id=row.id,
            family_name=row.family_name,
            given_name=row.given_name,
            insz=insz_by_patient.get(row.id),
            primary_organisation_id=row.primary_organisation_id,
        )
        for row in patient_rows
    }


async def _resolve_participants(
    session: AsyncSession, appointment_ids: list[UUID]
) -> dict[UUID, list[AppointmentParticipantInlineSummary]]:
    if not appointment_ids:
        return {}

    rows = (
        await session.execute(
            select(
                AppointmentParticipant.appointment_id,
                AppointmentParticipant.user_id,
                AppointmentParticipant.role,
                User.display_name,
            )
            .join(User, User.id == AppointmentParticipant.user_id)
            .where(
                AppointmentParticipant.appointment_id.in_(appointment_ids),
                AppointmentParticipant.deleted_at.is_(None),
            )
        )
    ).all()

    by_appointment: dict[UUID, list[AppointmentParticipantInlineSummary]] = {}
    for appointment_id, user_id, role, display_name in rows:
        by_appointment.setdefault(appointment_id, []).append(
            AppointmentParticipantInlineSummary(
                user_id=user_id,
                role=role,
                user_display_name=display_name,
            )
        )
    return by_appointment


def _project(
    appointment: Appointment,
    patient_summary: PatientInlineSummary,
    participants: list[AppointmentParticipantInlineSummary],
) -> TaskItem:
    payload = AppointmentPayload(
        id=appointment.id,
        patient=patient_summary,
        starts_at=appointment.starts_at,
        ends_at=appointment.ends_at,
        kind=appointment.kind,
        modality=appointment.modality,
        location_text=appointment.location_text,
        status=appointment.status,
        participants=participants,
    )
    return TaskItem(
        id=appointment.id,
        source=SOURCE_NAME,
        source_id=appointment.id,
        due_at=appointment.starts_at,
        title=appointment.title,
        kind=appointment.kind.value,
        priority=None,
        payload=payload,
    )


class AppointmentSource:
    """v1 source — appointments booked in the next 30 days the caller participates in."""

    name: Final[str] = SOURCE_NAME

    async def list(
        self,
        session: AsyncSession,
        caller: SessionUser,
        *,
        page: int,
        page_size: int,
        patient_id_filter: UUID | None = None,
    ) -> Page[TaskItem]:
        start, end = _window_bounds()
        predicates = _base_predicate(caller, start, end)
        if patient_id_filter is not None:
            predicates = (*predicates, Appointment.patient_id == patient_id_filter)

        base_query = (
            select(Appointment)
            .join(
                AppointmentParticipant,
                AppointmentParticipant.appointment_id == Appointment.id,
            )
            .where(and_(*predicates))
        )

        total = (
            await session.execute(
                select(func.count())
                .select_from(Appointment)
                .join(
                    AppointmentParticipant,
                    AppointmentParticipant.appointment_id == Appointment.id,
                )
                .where(and_(*predicates))
            )
        ).scalar_one()

        offset = (page - 1) * page_size
        rows = (
            (
                await session.execute(
                    base_query.order_by(Appointment.starts_at.asc())
                    .offset(offset)
                    .limit(page_size)
                )
            )
            .scalars()
            .all()
        )

        patient_ids = [row.patient_id for row in rows]
        appointment_ids = [row.id for row in rows]
        patient_summaries = await _resolve_patient_summaries(session, patient_ids)
        participants_by_appointment = await _resolve_participants(session, appointment_ids)

        items = [
            _project(
                row,
                patient_summaries[row.patient_id],
                participants_by_appointment.get(row.id, []),
            )
            for row in rows
        ]
        return Page[TaskItem].build(
            items=items, page=page, page_size=page_size, total=total
        )

    async def get(
        self, session: AsyncSession, caller: SessionUser, source_id: UUID
    ) -> TaskItem | None:
        start, end = _window_bounds()
        predicates = (*_base_predicate(caller, start, end), Appointment.id == source_id)
        row = (
            await session.execute(
                select(Appointment)
                .join(
                    AppointmentParticipant,
                    AppointmentParticipant.appointment_id == Appointment.id,
                )
                .where(and_(*predicates))
            )
        ).scalar_one_or_none()
        if row is None:
            return None
        patient_summaries = await _resolve_patient_summaries(session, [row.patient_id])
        participants_by_appointment = await _resolve_participants(session, [row.id])
        return _project(
            row,
            patient_summaries[row.patient_id],
            participants_by_appointment.get(row.id, []),
        )
