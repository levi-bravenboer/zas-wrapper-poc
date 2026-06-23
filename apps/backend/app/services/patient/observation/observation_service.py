"""Service for locally-entered measurements (`observations` table).

Pure CRUD: create one observation, list observations for a patient. No
clinical interpretation, no thresholds, no derived signals — values pass
through exactly as entered (MDR-gated logic is deliberately out of scope).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.collaboration import OwnerType
from app.db.models.appointment.appointment import Appointment
from app.db.models.patient.observation import Observation
from app.db.models.task.task import Task
from app.db.models.user import User
from app.services.patient.observation.errors import (
    MissingSecondaryValueError,
    UnexpectedSecondaryValueError,
    UnsupportedObservationTypeError,
)
from app.services.patient.observation.types import (
    SUPPORTED_MEASUREMENT_TYPES,
    MeasurementType,
)


class ObservationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        patient_id: UUID,
        measurement_type: MeasurementType,
        value: Decimal,
        value_secondary: Decimal | None,
        effective_date_time: datetime | None,
        performer_id: UUID,
        owner_type: OwnerType | None,
        owner_id: UUID | None,
    ) -> tuple[Observation, str, str | None]:
        spec = SUPPORTED_MEASUREMENT_TYPES.get(measurement_type)
        if spec is None:
            raise UnsupportedObservationTypeError()
        if spec.secondary_code is not None and value_secondary is None:
            raise MissingSecondaryValueError()
        if spec.secondary_code is None and value_secondary is not None:
            raise UnexpectedSecondaryValueError()
        resolved_owner_type = owner_type or OwnerType.PATIENT
        resolved_owner_id = owner_id or patient_id
        observation = Observation(
            patient_id=patient_id,
            owner_type=resolved_owner_type,
            owner_id=resolved_owner_id,
            code=spec.code,
            code_system=spec.code_system,
            value=value,
            unit=spec.unit,
            value_secondary=value_secondary,
            secondary_code=spec.secondary_code,
            secondary_unit=spec.secondary_unit,
            effective_date_time=effective_date_time or datetime.now(UTC),
            performer_id=performer_id,
        )
        self._session.add(observation)
        await self._session.flush()
        await self._session.refresh(observation)
        display_name = await self._session.scalar(
            select(User.display_name).where(User.id == performer_id)
        )
        labels = await self._owner_labels({resolved_owner_type: {resolved_owner_id}})
        return observation, display_name or "", labels.get(resolved_owner_id)

    async def list_for_patient(
        self, patient_id: UUID, tenant_id: UUID
    ) -> list[tuple[Observation, str, str | None]]:
        result = await self._session.execute(
            select(Observation, User.display_name)
            .join(User, User.id == Observation.performer_id)
            .where(
                Observation.patient_id == patient_id,
                Observation.deleted_at.is_(None),
            )
            .order_by(Observation.effective_date_time.desc())
        )
        rows: Sequence[tuple[Observation, str]] = list(result.tuples().all())
        ids_by_type: dict[OwnerType, set[UUID]] = {}
        for obs, _name in rows:
            if obs.owner_type == OwnerType.PATIENT:
                continue
            ids_by_type.setdefault(obs.owner_type, set()).add(obs.owner_id)
        labels = await self._owner_labels(ids_by_type, tenant_id=tenant_id)
        return [(obs, name, labels.get(obs.owner_id)) for obs, name in rows]

    async def _owner_labels(
        self,
        ids_by_type: dict[OwnerType, set[UUID]],
        *,
        tenant_id: UUID | None = None,
    ) -> dict[UUID, str]:
        """Resolve a human label per owner — appointment / task title — so the
        patient aggregate can show where each observation came from. Mirrors
        `NoteRepository.owner_labels`; pathway-step not surfaced for now."""

        out: dict[UUID, str] = {}
        appointments = ids_by_type.get(OwnerType.APPOINTMENT)
        if appointments:
            stmt = select(Appointment.id, Appointment.title).where(Appointment.id.in_(appointments))
            if tenant_id is not None:
                stmt = stmt.where(Appointment.tenant_id == tenant_id)
            for owner_id, title in await self._session.execute(stmt):
                out[owner_id] = title
        tasks = ids_by_type.get(OwnerType.TASK)
        if tasks:
            stmt = select(Task.id, Task.title).where(Task.id.in_(tasks))
            if tenant_id is not None:
                stmt = stmt.where(Task.tenant_id == tenant_id)
            for owner_id, title in await self._session.execute(stmt):
                out[owner_id] = title
        return out
