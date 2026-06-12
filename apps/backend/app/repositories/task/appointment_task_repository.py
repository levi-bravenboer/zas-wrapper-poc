# SQL access for the `/tasks` aggregator's `appointment` source. All queries
# for the projection live here per the layer rules (services hold no SQL).
#
# Query plan: appointments JOIN appointment_participants on the caller's
# user_id (active rows only) JOIN patients (live rows only — soft-deleted
# patients never surface tasks). The patient inline summaries and the
# participant strips are resolved by separate batched queries keyed by the
# matched ids — no N+1. INSZ resolves through `patient_identifiers` with the
# Belgian eHealth INSZ system URN from `app/core/identifiers.py`.

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import ColumnElement, Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import AppointmentParticipantRole, AppointmentStatus
from app.core.identifiers import INSZ_SYSTEM
from app.db.models.appointment import Appointment, AppointmentParticipant
from app.db.models.patient import Patient
from app.db.models.patient.patient_identifier import PatientIdentifier
from app.db.models.user import User


class AppointmentTaskRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _window_predicates(
        *,
        tenant_id: UUID,
        caller_id: UUID,
        window_start: datetime,
        window_end: datetime,
    ) -> tuple[ColumnElement[bool], ...]:
        return (
            Appointment.tenant_id == tenant_id,
            Appointment.deleted_at.is_(None),
            Appointment.status == AppointmentStatus.BOOKED,
            Appointment.starts_at >= window_start,
            Appointment.starts_at <= window_end,
            AppointmentParticipant.user_id == caller_id,
            AppointmentParticipant.deleted_at.is_(None),
            AppointmentParticipant.tenant_id == tenant_id,
            Patient.deleted_at.is_(None),
        )

    @classmethod
    def _base_query(
        cls,
        *,
        tenant_id: UUID,
        caller_id: UUID,
        window_start: datetime,
        window_end: datetime,
        patient_id: UUID | None,
    ) -> Select[tuple[Appointment]]:
        predicates = cls._window_predicates(
            tenant_id=tenant_id,
            caller_id=caller_id,
            window_start=window_start,
            window_end=window_end,
        )
        if patient_id is not None:
            predicates = (*predicates, Appointment.patient_id == patient_id)
        return (
            select(Appointment)
            .join(
                AppointmentParticipant,
                AppointmentParticipant.appointment_id == Appointment.id,
            )
            .join(Patient, Patient.id == Appointment.patient_id)
            .where(and_(*predicates))
        )

    async def count_window(
        self,
        *,
        tenant_id: UUID,
        caller_id: UUID,
        window_start: datetime,
        window_end: datetime,
        patient_id: UUID | None = None,
    ) -> int:
        base = self._base_query(
            tenant_id=tenant_id,
            caller_id=caller_id,
            window_start=window_start,
            window_end=window_end,
            patient_id=patient_id,
        )
        result = await self._session.execute(
            select(func.count()).select_from(base.subquery())
        )
        return result.scalar_one()

    async def list_window(
        self,
        *,
        tenant_id: UUID,
        caller_id: UUID,
        window_start: datetime,
        window_end: datetime,
        patient_id: UUID | None = None,
        offset: int,
        limit: int,
    ) -> Sequence[Appointment]:
        base = self._base_query(
            tenant_id=tenant_id,
            caller_id=caller_id,
            window_start=window_start,
            window_end=window_end,
            patient_id=patient_id,
        )
        result = await self._session.execute(
            base.order_by(Appointment.starts_at.asc()).offset(offset).limit(limit)
        )
        return result.scalars().all()

    async def get_window_row(
        self,
        *,
        tenant_id: UUID,
        caller_id: UUID,
        window_start: datetime,
        window_end: datetime,
        appointment_id: UUID,
    ) -> Appointment | None:
        base = self._base_query(
            tenant_id=tenant_id,
            caller_id=caller_id,
            window_start=window_start,
            window_end=window_end,
            patient_id=None,
        )
        result = await self._session.execute(base.where(Appointment.id == appointment_id))
        return result.scalar_one_or_none()

    async def patient_rows(
        self, patient_ids: Sequence[UUID]
    ) -> Sequence[tuple[UUID, str, str, UUID]]:
        if not patient_ids:
            return []
        result = await self._session.execute(
            select(
                Patient.id,
                Patient.family_name,
                Patient.given_name,
                Patient.primary_organisation_id,
            ).where(Patient.id.in_(patient_ids), Patient.deleted_at.is_(None))
        )
        return result.tuples().all()

    async def insz_by_patient(self, patient_ids: Sequence[UUID]) -> dict[UUID, str]:
        if not patient_ids:
            return {}
        result = await self._session.execute(
            select(PatientIdentifier.patient_id, PatientIdentifier.value).where(
                PatientIdentifier.patient_id.in_(patient_ids),
                PatientIdentifier.system == INSZ_SYSTEM,
                PatientIdentifier.deleted_at.is_(None),
            )
        )
        return {patient_id: value for patient_id, value in result.tuples().all()}

    async def participant_rows(
        self, appointment_ids: Sequence[UUID]
    ) -> Sequence[tuple[UUID, UUID, AppointmentParticipantRole, str]]:
        if not appointment_ids:
            return []
        result = await self._session.execute(
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
        return result.tuples().all()
