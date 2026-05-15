from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import Select, func, select

from app.db.models.patient import Patient, PatientIdentifier
from app.repositories.base import BaseRepository


@dataclass(slots=True, frozen=True)
class PatientFilters:
    """FHIR-aligned discrete search params for `GET /patients`.

    `identifier` short-circuits the other filters when set (returns the
    at-most-one match across any system). See design.md OQ2.
    """

    family_name: str | None = None
    given_name: str | None = None
    birth_date: date | None = None
    identifier: str | None = None


class PatientRepository(BaseRepository[Patient]):
    model = Patient

    async def get_by_id(self, tenant_id: UUID, patient_id: UUID) -> Patient | None:
        result = await self._session.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.tenant_id == tenant_id,
                Patient.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_in_tenant(
        self,
        tenant_id: UUID,
        filters: PatientFilters,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[Patient], int]:
        base = self._tenant_scope(tenant_id, filters)
        total = await self._session.scalar(select(func.count()).select_from(base.subquery()))
        result = await self._session.execute(
            base.order_by(Patient.family_name, Patient.given_name, Patient.id)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().unique().all()), int(total or 0)

    async def update(self, patient: Patient) -> Patient:
        await self._session.flush()
        return patient

    def _tenant_scope(self, tenant_id: UUID, filters: PatientFilters) -> Select[tuple[Patient]]:
        stmt: Select[tuple[Patient]] = select(Patient).where(
            Patient.tenant_id == tenant_id,
            Patient.deleted_at.is_(None),
        )
        if filters.identifier is not None:
            # Short-circuit: identifier exact match across any system.
            # Join through `patients` so tenant scope remains enforced even
            # though `patient_identifiers` has no tenant column (design.md
            # risk note).
            stmt = stmt.join(PatientIdentifier, PatientIdentifier.patient_id == Patient.id).where(
                PatientIdentifier.value == filters.identifier,
                PatientIdentifier.deleted_at.is_(None),
            )
            return stmt
        if filters.family_name:
            stmt = stmt.where(Patient.family_name.ilike(f"{filters.family_name}%"))
        if filters.given_name:
            stmt = stmt.where(Patient.given_name.ilike(f"{filters.given_name}%"))
        if filters.birth_date is not None:
            stmt = stmt.where(Patient.birth_date == filters.birth_date)
        return stmt
