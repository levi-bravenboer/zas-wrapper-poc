"""Service for locally-entered measurements (`observations` table).

Pure CRUD: create one observation, list observations for a patient. No
clinical interpretation, no thresholds, no derived signals — values pass
through exactly as entered (MDR-gated logic is deliberately out of scope).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.patient.observation import Observation
from app.services.patient.observation.errors import UnsupportedObservationTypeError
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
        effective_date_time: datetime | None,
        performer_id: UUID,
    ) -> Observation:
        spec = SUPPORTED_MEASUREMENT_TYPES.get(measurement_type)
        if spec is None:
            raise UnsupportedObservationTypeError()
        observation = Observation(
            patient_id=patient_id,
            code=spec.code,
            code_system=spec.code_system,
            value=value,
            unit=spec.unit,
            effective_date_time=effective_date_time or datetime.now(UTC),
            performer_id=performer_id,
        )
        self._session.add(observation)
        await self._session.flush()
        await self._session.refresh(observation)
        return observation

    async def list_for_patient(self, patient_id: UUID) -> list[Observation]:
        result = await self._session.execute(
            select(Observation)
            .where(
                Observation.patient_id == patient_id,
                Observation.deleted_at.is_(None),
            )
            .order_by(Observation.effective_date_time.desc())
        )
        return list(result.scalars().all())
