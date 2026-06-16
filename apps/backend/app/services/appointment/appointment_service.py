# Read-only appointment service: assembles `AppointmentRead` from source rows
# + batched patient/participant lookups (no N+1). Holds no SQL — the
# `AppointmentReadRepository` owns queries; this layer orchestrates + projects.

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from app.core.enums.user import Role
from app.db.models.appointment import Appointment
from app.repositories.appointment import AppointmentReadRepository
from app.schemas._list.page import Page
from app.schemas.appointment.appointment import (
    AppointmentParticipantInlineSummary,
    AppointmentRead,
    PatientAppointmentEntry,
)
from app.schemas.auth.auth import SessionUser
from app.schemas.patient.patient import PatientInlineSummary


class AppointmentReadService:
    def __init__(self, repo: AppointmentReadRepository) -> None:
        self._repo = repo

    async def list_visible(
        self, caller: SessionUser, *, page: int, page_size: int
    ) -> Page[AppointmentRead]:
        admin = caller.role == Role.ADMIN
        total = await self._repo.count_visible(
            tenant_id=caller.tenant_id, caller_id=caller.id, admin=admin
        )
        rows = await self._repo.list_visible(
            tenant_id=caller.tenant_id,
            caller_id=caller.id,
            admin=admin,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        items = await self._assemble(list(rows))
        return Page[AppointmentRead].build(
            items=items, page=page, page_size=page_size, total=total
        )

    async def get(self, *, tenant_id: UUID, appointment_id: UUID) -> AppointmentRead | None:
        row = await self._repo.get_in_tenant(tenant_id=tenant_id, appointment_id=appointment_id)
        if row is None:
            return None
        items = await self._assemble([row])
        return items[0] if items else None

    async def list_for_patient(
        self, *, tenant_id: UUID, patient_id: UUID
    ) -> list[PatientAppointmentEntry]:
        rows, about_ids = await self._repo.list_for_patient(
            tenant_id=tenant_id, patient_id=patient_id
        )
        reads = await self._assemble(list(rows))
        return [
            PatientAppointmentEntry(
                relation="about" if read.id in about_ids else "with",
                appointment=read,
            )
            for read in reads
        ]

    async def _assemble(self, rows: Sequence[Appointment]) -> list[AppointmentRead]:
        if not rows:
            return []
        patient_ids = [row.patient_id for row in rows]
        appointment_ids = [row.id for row in rows]

        insz_by_patient = await self._repo.insz_by_patient(patient_ids)
        summaries: dict[UUID, PatientInlineSummary] = {
            patient_id: PatientInlineSummary(
                id=patient_id,
                family_name=family_name,
                given_name=given_name,
                insz=insz_by_patient.get(patient_id),
                primary_organisation_id=primary_organisation_id,
            )
            for patient_id, family_name, given_name, primary_organisation_id in (
                await self._repo.patient_rows(patient_ids)
            )
        }

        participants: dict[UUID, list[AppointmentParticipantInlineSummary]] = {}
        for appointment_id, user_id, role, display_name in await self._repo.participant_rows(
            appointment_ids
        ):
            participants.setdefault(appointment_id, []).append(
                AppointmentParticipantInlineSummary(
                    user_id=user_id, role=role, user_display_name=display_name
                )
            )

        # Drop a row whose patient was soft-deleted between queries (READ
        # COMMITTED race) rather than 500.
        return [
            AppointmentRead(
                id=row.id,
                patient=summaries[row.patient_id],
                title=row.title,
                description=row.description,
                kind=row.kind,
                starts_at=row.starts_at,
                ends_at=row.ends_at,
                modality=row.modality,
                location_text=row.location_text,
                status=row.status,
                participants=participants.get(row.id, []),
            )
            for row in rows
            if row.patient_id in summaries
        ]
