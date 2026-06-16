from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select

from app.core.enums.user import Role
from app.core.settings import SettingsDep
from app.db.engine import SessionDep
from app.db.models.access.access_grant import AccessGrant
from app.db.models.patient import Patient
from app.repositories.organisation.deps import OrganisationRepoDep
from app.repositories.patient.deps import PatientRepoDep
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.access.permissions.deps import (
    KetoClientDep,
    PatientRelation,
    check_patient_permission,
)
from app.services.care_team.deps import CareTeamServiceDep
from app.services.patient.errors import PatientNotFoundError
from app.services.patient.patient_service import PatientService
from app.services.practitioner_role.predicates import (
    patient_root_org,
    practitioner_root_orgs_for,
)

logger = logging.getLogger(__name__)


def get_patient_service(
    repo: PatientRepoDep,
    organisation_repo: OrganisationRepoDep,
    care_team_service: CareTeamServiceDep,
    session: SessionDep,
) -> PatientService:
    return PatientService(repo, organisation_repo, care_team_service, session)


PatientServiceDep = Annotated[PatientService, Depends(get_patient_service)]


def require_patient_relation(relation: PatientRelation):
    """Factory: patient guard checking a specific Keto verb (access-entitlements).

    `require_patient_access` (= the `view` instance) stays the default wiring
    point; write routes graduate to `edit` / `record` so verb-granular
    external grants (REQ-FUN-42) and the internal verb split (care team
    edits, org chain reads) are enforced from one place. Flag-off keeps the
    pre-Ory SQL predicates with NO verb distinction — exactly the previous
    behaviour.
    """

    async def _require(
        patient_id: UUID,
        service: PatientServiceDep,
        care_team_service: CareTeamServiceDep,
        session: SessionDep,
        settings: SettingsDep,
        keto: KetoClientDep,
        current_user: SessionUser = Depends(require_role(Role.ADMIN, Role.CAREGIVER)),
    ) -> Patient:
        return await _resolve_patient_with_relation(
            patient_id,
            service,
            care_team_service,
            session,
            settings,
            keto,
            current_user,
            relation=relation,
        )

    return _require


async def _resolve_patient_with_relation(
    patient_id: UUID,
    service: PatientService,
    care_team_service,
    session,
    settings,
    keto,
    current_user: SessionUser,
    *,
    relation: PatientRelation,
) -> Patient:
    """Resolve a patient inside the caller's tenant or raise 404.

    Admins see every patient in their tenant. Caregivers must hold a
    relation to the patient: with `AUTHZ_KETO_ENABLED` one Keto check
    answers care-team membership, org-tree reachability, and external
    grants in a single relation walk; with the flag off the same facts
    are evaluated via the pre-Ory SQL predicates — (a) open
    `CareTeamParticipant` row on a team for this patient, or (b) the
    patient's primary org descends from a root reachable via an open
    `PractitionerRole`. Cross-team and cross-tenant misses both surface
    as 404 by design — leaking existence is a worse failure mode than a
    vague 404.
    """

    # AUTH-HARDEN: relation-checked via Keto when AUTHZ_KETO_ENABLED (BL-020/BL-053)
    patient = await service.get_by_id(current_user.tenant_id, patient_id)
    if patient is None:
        raise PatientNotFoundError()
    if current_user.role == Role.ADMIN:
        return patient

    if settings.authz_keto_enabled:
        allowed = await check_patient_permission(
            keto, patient_id=patient_id, user_id=current_user.id, relation=relation
        )
        if not allowed:
            raise PatientNotFoundError()
        # Break-glass uses are distinguishable in the audit stream (REQ-NON-8):
        # if the caller holds an active grant for this patient, log its id.
        grant_id = await session.scalar(
            select(AccessGrant.id)
            .where(
                AccessGrant.patient_id == patient_id,
                AccessGrant.user_id == current_user.id,
                AccessGrant.revoked_at.is_(None),
                AccessGrant.deleted_at.is_(None),
                AccessGrant.expires_at > datetime.now(UTC),
            )
            .limit(1)
        )
        if grant_id is not None:
            logger.info(
                "break-glass access: user=%s patient=%s grant=%s",
                current_user.id,
                patient_id,
                grant_id,
            )
        return patient

    has_membership = await care_team_service.has_open_membership(current_user.id, patient_id)
    if not has_membership:
        root_orgs = await practitioner_root_orgs_for(session, current_user)
        patient_root = await patient_root_org(
            session, current_user.tenant_id, patient.primary_organisation_id
        )
        if patient_root is None or patient_root not in root_orgs:
            raise PatientNotFoundError()
    return patient


require_patient_access = require_patient_relation("view")

# Public alias for the underlying resolver — lets sibling guards (e.g.
# the enrollment-keyed access guard in
# `app.api.routers.pathway.enrollment_router`) delegate to the same
# Keto-graduated / SQL-fallback patient-verb logic without reaching
# across modules for a `_`-prefixed name. Keep the private name as the
# canonical implementation so the existing dep factory stays unchanged.
resolve_patient_with_relation = _resolve_patient_with_relation

PatientAccessDep = Annotated[Patient, Depends(require_patient_access)]
# Write routes: verb-granular guard (REQ-FUN-42) — care-team members,
# break-glass grantees and external_writer subjects only when the flag is on.
PatientEditDep = Annotated[Patient, Depends(require_patient_relation("edit"))]
