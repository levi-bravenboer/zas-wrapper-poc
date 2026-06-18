from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import Permission
from app.db.models.patient import Patient, PatientIdentifier
from app.repositories.organisation.organisation_repository import OrganisationRepository
from app.repositories.patient.patient_repository import PatientRepository
from app.schemas._list.list_query import ListQuery
from app.schemas._list.page import Page
from app.schemas.auth.auth import SessionUser
from app.schemas.patient.patient import PatientCreate, PatientUpdate
from app.services.care_team.care_team_service import CareTeamService
from app.services.organisation.errors import (
    CrossTenantOrganisationError,
    OrganisationNotFoundError,
)
from app.services.patient.errors import (
    PatientIdentifiersImmutableError,
    PatientNotFoundError,
)
from app.services.practitioner_role.predicates import (
    patient_ids_under_roots,
    practitioner_root_orgs_for,
)


class PatientService:
    """Tenant-scoped orchestration for patients.

    Listing flows through this service so caregiver visibility is enforced
    in one place: caregivers see a patient when ANY of these holds:

    - they have an open `CareTeamParticipant` row on a care team for that
      patient, OR
    - the patient's `primary_organisation_id` descends from a root org the
      caregiver can act under via an open `PractitionerRole`.

    Admins bypass both checks and see every patient in their tenant.
    """

    def __init__(
        self,
        repo: PatientRepository,
        organisation_repo: OrganisationRepository,
        care_team_service: CareTeamService,
        session: AsyncSession,
    ) -> None:
        self._repo = repo
        self._org_repo = organisation_repo
        self._care_team_service = care_team_service
        self._session = session

    async def list_in_tenant(
        self,
        actor: SessionUser,
        query: ListQuery,
        *,
        identifier: str | None = None,
    ) -> Page[Patient]:
        repo = self._repo.with_identifier(identifier)
        if actor.has_permission(Permission.PATIENT_ACCESS_ALL):
            return await repo.list_page(query)
        via_care_team = await self._care_team_service.visible_patient_ids_for(actor)
        root_orgs = await practitioner_root_orgs_for(self._session, actor)
        via_roles = await patient_ids_under_roots(self._session, actor.tenant_id, root_orgs)
        visible = via_care_team | via_roles
        if not visible:
            return Page[Patient](
                items=[],
                page=query.page,
                page_size=query.page_size,
                total=0,
                total_pages=0,
            )
        return await repo.with_visible_ids(frozenset(visible)).list_page(query)

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
