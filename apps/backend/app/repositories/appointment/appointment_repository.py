# SQL access for the first-class `/appointments` read API. Mirrors the
# query plan the removed `/tasks` appointment source used: visibility is
# participant-driven (caller must hold an active `appointment_participants`
# row), scoped to the tenant, booked-window for the list. Patient summaries
# + participant strips are resolved by batched id-keyed lookups (no N+1).

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Final
from uuid import UUID

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import AppointmentParticipantRole, AppointmentStatus
from app.core.identifiers import INSZ_SYSTEM
from app.db.models.appointment import (
    Appointment,
    AppointmentParticipant,
    AppointmentPatientAttendee,
)
from app.db.models.patient import Patient
from app.db.models.patient.patient_identifier import PatientIdentifier
from app.db.models.user import User

WINDOW_DAYS: Final[int] = 30


def _window_bounds() -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    return now, now + timedelta(days=WINDOW_DAYS)


class AppointmentReadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── caregiver list: booked window + active participant for the caller ──

    @staticmethod
    def _list_predicates(
        *, tenant_id: UUID, caller_id: UUID, window_start: datetime, window_end: datetime
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
        )

    def _participant_list_query(
        self, *, tenant_id: UUID, caller_id: UUID
    ) -> Select[tuple[Appointment]]:
        window_start, window_end = _window_bounds()
        predicates = self._list_predicates(
            tenant_id=tenant_id,
            caller_id=caller_id,
            window_start=window_start,
            window_end=window_end,
        )
        return (
            select(Appointment)
            .join(AppointmentParticipant, AppointmentParticipant.appointment_id == Appointment.id)
            .where(and_(*predicates))
        )

    def _admin_list_query(self, *, tenant_id: UUID) -> Select[tuple[Appointment]]:
        window_start, window_end = _window_bounds()
        return select(Appointment).where(
            Appointment.tenant_id == tenant_id,
            Appointment.deleted_at.is_(None),
            Appointment.status == AppointmentStatus.BOOKED,
            Appointment.starts_at >= window_start,
            Appointment.starts_at <= window_end,
        )

    async def count_visible(self, *, tenant_id: UUID, caller_id: UUID, admin: bool) -> int:
        base = (
            self._admin_list_query(tenant_id=tenant_id)
            if admin
            else self._participant_list_query(tenant_id=tenant_id, caller_id=caller_id)
        )
        result = await self._session.execute(select(func.count()).select_from(base.subquery()))
        return result.scalar_one()

    async def list_visible(
        self, *, tenant_id: UUID, caller_id: UUID, admin: bool, offset: int, limit: int
    ) -> Sequence[Appointment]:
        base = (
            self._admin_list_query(tenant_id=tenant_id)
            if admin
            else self._participant_list_query(tenant_id=tenant_id, caller_id=caller_id)
        )
        result = await self._session.execute(
            base.order_by(Appointment.starts_at.asc(), Appointment.id.asc())
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all()

    async def exists_for_block_instance(self, execution_id: UUID) -> bool:
        """Whether a pathway step already materialised an appointment (idempotency)."""
        existing = await self._session.scalar(
            select(Appointment.id).where(
                Appointment.pathway_block_instance_id == execution_id,
                Appointment.deleted_at.is_(None),
            )
        )
        return existing is not None

    async def is_participant(self, *, appointment_id: UUID, user_id: UUID) -> bool:
        result = await self._session.execute(
            select(AppointmentParticipant.id)
            .where(
                AppointmentParticipant.appointment_id == appointment_id,
                AppointmentParticipant.user_id == user_id,
                AppointmentParticipant.deleted_at.is_(None),
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def get_in_tenant(self, *, tenant_id: UUID, appointment_id: UUID) -> Appointment | None:
        # No window/status filter: detail access is enforced by the route's
        # access dependency, not by hiding non-booked or past appointments.
        result = await self._session.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.tenant_id == tenant_id,
                Appointment.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    # ── patient-keyed: about (subject) ∪ with (attendee) ──

    async def list_for_patient(
        self, *, tenant_id: UUID, patient_id: UUID
    ) -> tuple[Sequence[Appointment], set[UUID]]:
        """Return appointments related to a patient + the set of ids the
        patient is the SUBJECT of (relation `about`); the rest are `with`."""

        attendee_subq = (
            select(AppointmentPatientAttendee.appointment_id)
            .where(
                AppointmentPatientAttendee.patient_id == patient_id,
                AppointmentPatientAttendee.deleted_at.is_(None),
            )
            .scalar_subquery()
        )
        result = await self._session.execute(
            select(Appointment)
            .where(
                Appointment.tenant_id == tenant_id,
                Appointment.deleted_at.is_(None),
                or_(
                    Appointment.patient_id == patient_id,
                    Appointment.id.in_(attendee_subq),
                ),
            )
            .order_by(Appointment.starts_at.asc(), Appointment.id.asc())
        )
        rows = result.scalars().all()
        about_ids = {row.id for row in rows if row.patient_id == patient_id}
        return rows, about_ids

    # ── batched inline-summary lookups (no N+1) ──

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
            select(PatientIdentifier.patient_id, PatientIdentifier.value)
            .where(
                PatientIdentifier.patient_id.in_(patient_ids),
                PatientIdentifier.system == INSZ_SYSTEM,
                PatientIdentifier.deleted_at.is_(None),
            )
            .order_by(PatientIdentifier.created_at, PatientIdentifier.id)
        )
        insz: dict[UUID, str] = {}
        for patient_id, value in result.tuples().all():
            insz.setdefault(patient_id, value)
        return insz

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
