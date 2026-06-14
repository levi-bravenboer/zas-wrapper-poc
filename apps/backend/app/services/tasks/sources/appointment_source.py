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
# SQL lives in `AppointmentTaskRepository` (layer rules: services hold no
# SQL); this module owns projection into the `TaskItem` envelope only.

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Final
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.appointment import Appointment
from app.repositories.task.appointment_task_repository import AppointmentTaskRepository
from app.schemas._list.page import Page
from app.schemas.appointment.appointment import AppointmentParticipantInlineSummary
from app.schemas.auth.auth import SessionUser
from app.schemas.patient.patient import PatientInlineSummary
from app.schemas.task.task_item import AppointmentPayload, TaskItem

SOURCE_NAME: Final[str] = "appointment"
WINDOW_DAYS: Final[int] = 30


def _window_bounds() -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    return now, now + timedelta(days=WINDOW_DAYS)


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

    def __init__(self, session: AsyncSession) -> None:
        self._repository = AppointmentTaskRepository(session)

    async def _assemble(self, rows: list[Appointment]) -> list[TaskItem]:
        patient_ids = [row.patient_id for row in rows]
        appointment_ids = [row.id for row in rows]

        insz_by_patient = await self._repository.insz_by_patient(patient_ids)
        summaries: dict[UUID, PatientInlineSummary] = {
            patient_id: PatientInlineSummary(
                id=patient_id,
                family_name=family_name,
                given_name=given_name,
                insz=insz_by_patient.get(patient_id),
                primary_organisation_id=primary_organisation_id,
            )
            for patient_id, family_name, given_name, primary_organisation_id in (
                await self._repository.patient_rows(patient_ids)
            )
        }

        participants: dict[UUID, list[AppointmentParticipantInlineSummary]] = {}
        for appointment_id, user_id, role, display_name in (
            await self._repository.participant_rows(appointment_ids)
        ):
            participants.setdefault(appointment_id, []).append(
                AppointmentParticipantInlineSummary(
                    user_id=user_id, role=role, user_display_name=display_name
                )
            )

        # Guard the READ COMMITTED race where a patient is soft-deleted between
        # the window query and the summary lookup — drop the row instead of 500.
        return [
            _project(row, summaries[row.patient_id], participants.get(row.id, []))
            for row in rows
            if row.patient_id in summaries
        ]

    async def list(
        self,
        caller: SessionUser,
        *,
        page: int,
        page_size: int,
        patient_id_filter: UUID | None = None,
    ) -> Page[TaskItem]:
        window_start, window_end = _window_bounds()
        total = await self._repository.count_window(
            tenant_id=caller.tenant_id,
            caller_id=caller.id,
            window_start=window_start,
            window_end=window_end,
            patient_id=patient_id_filter,
        )
        rows = await self._repository.list_window(
            tenant_id=caller.tenant_id,
            caller_id=caller.id,
            window_start=window_start,
            window_end=window_end,
            patient_id=patient_id_filter,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        items = await self._assemble(list(rows))
        return Page[TaskItem].build(items=items, page=page, page_size=page_size, total=total)

    async def get(self, caller: SessionUser, source_id: UUID) -> TaskItem | None:
        window_start, window_end = _window_bounds()
        row = await self._repository.get_window_row(
            tenant_id=caller.tenant_id,
            caller_id=caller.id,
            window_start=window_start,
            window_end=window_end,
            appointment_id=source_id,
        )
        if row is None:
            return None
        items = await self._assemble([row])
        return items[0] if items else None
