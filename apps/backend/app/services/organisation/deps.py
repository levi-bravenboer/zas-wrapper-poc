from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.repositories.organisation.deps import OrganisationRepoDep
from app.services.organisation.organisation_service import OrganisationService


def get_organisation_service(repo: OrganisationRepoDep) -> OrganisationService:
    return OrganisationService(repo)


OrganisationServiceDep = Annotated[OrganisationService, Depends(get_organisation_service)]
