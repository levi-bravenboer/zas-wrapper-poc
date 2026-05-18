from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.organisation.deps import OrganisationRepoDep
from app.services.organisation.organisation_service import OrganisationService
from app.services.organisation.organisation_tree_service import OrganisationTreeService


def get_organisation_service(session: SessionDep, repo: OrganisationRepoDep) -> OrganisationService:
    return OrganisationService(session, repo)


def get_organisation_tree_service(session: SessionDep) -> OrganisationTreeService:
    return OrganisationTreeService(session)


OrganisationServiceDep = Annotated[OrganisationService, Depends(get_organisation_service)]
OrganisationTreeServiceDep = Annotated[
    OrganisationTreeService, Depends(get_organisation_tree_service)
]
