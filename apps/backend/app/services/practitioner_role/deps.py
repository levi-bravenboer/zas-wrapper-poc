from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.services.organisation.deps import OrganisationServiceDep
from app.services.practitioner.deps import PractitionerServiceDep
from app.services.practitioner_role.practitioner_role_service import PractitionerRoleService


def get_practitioner_role_service(
    session: SessionDep,
    practitioner_service: PractitionerServiceDep,
    organisation_service: OrganisationServiceDep,
) -> PractitionerRoleService:
    return PractitionerRoleService(session, practitioner_service, organisation_service)


PractitionerRoleServiceDep = Annotated[
    PractitionerRoleService, Depends(get_practitioner_role_service)
]
