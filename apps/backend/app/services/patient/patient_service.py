from __future__ import annotations

from uuid import UUID

from app.db.models.patient import Patient, PatientIdentifier
from app.repositories.organisation.organisation_repository import OrganisationRepository
from app.repositories.patient.patient_repository import (
    PatientFilters,
    PatientRepository,
)
from app.schemas.auth.auth import SessionUser
from app.schemas.patient.patient import PatientCreate, PatientUpdate
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationNotFoundError,
)
from app.services.patient.errors import (
    PatientIdentifiersImmutableError,
    PatientNotFoundError,
)


class PatientService:
    """Tenant-scoped orchestration for patients.

    Visibility in `patients-base` is tenant-only: every list / get call
    filters by `actor.tenant_id`. Care-team-based caregiver filtering
    lands in `care-teams-base` (chain change #3) as a MODIFIED capability.
    """

    def __init__(
        self,
        repo: PatientRepository,
        organisation_repo: OrganisationRepository,
    ) -> None:
        self._repo = repo
        self._org_repo = organisation_repo

    async def list_in_tenant(
        self,
        tenant_id: UUID,
        filters: PatientFilters,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[Patient], int]:
        return await self._repo.list_in_tenant(tenant_id, filters, limit=limit, offset=offset)

    async def get_by_id(self, tenant_id: UUID, patient_id: UUID) -> Patient | None:
        return await self._repo.get_by_id(tenant_id, patient_id)

    async def create(self, actor: SessionUser, payload: PatientCreate) -> Patient:
        await self._assert_organisation_in_tenant(actor.tenant_id, payload.primary_organisation_id)
        patient = Patient(
            primary_organisation_id=payload.primary_organisation_id,
            given_name=payload.given_name,
            family_name=payload.family_name,
            birth_date=payload.birth_date,
            gender=payload.gender,
            source=payload.source,
            external_system=payload.external_system,
            external_ref=payload.external_ref,
            external_version=payload.external_version,
        )
        patient.identifiers = [
            PatientIdentifier(system=i.system, value=i.value, use=i.use)
            for i in payload.identifiers
        ]
        return await self._repo.add(patient)

    async def update(self, actor: SessionUser, patient_id: UUID, payload: PatientUpdate) -> Patient:
        # Defensive: `PatientUpdate` already rejects extras (422 via FastAPI),
        # but this guard lives in the service for callers (seed scripts,
        # adapters) that bypass the schema.
        if "identifiers" in payload.model_fields_set:
            raise PatientIdentifiersImmutableError()
        patient = await self._repo.get_by_id(actor.tenant_id, patient_id)
        if patient is None:
            raise PatientNotFoundError()
        data = payload.model_dump(exclude_unset=True)
        if "primary_organisation_id" in data:
            await self._assert_organisation_in_tenant(
                actor.tenant_id, data["primary_organisation_id"]
            )
        for field, value in data.items():
            setattr(patient, field, value)
        return await self._repo.update(patient)

    async def soft_delete(self, actor: SessionUser, patient_id: UUID) -> None:
        patient = await self._repo.get_by_id(actor.tenant_id, patient_id)
        if patient is None:
            raise PatientNotFoundError()
        await self._repo.soft_delete(patient)

    async def _assert_organisation_in_tenant(self, tenant_id: UUID, organisation_id: UUID) -> None:
        org = await self._org_repo.get_by_id(organisation_id)
        if org is None:
            raise OrganisationNotFoundError()
        if org.tenant_id != tenant_id:
            raise CrossTenantOrganisationError()
