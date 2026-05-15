from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.organisation.organisation_repository import OrganisationRepository


def get_organisation_repository(session: SessionDep) -> OrganisationRepository:
    return OrganisationRepository(session)


OrganisationRepoDep = Annotated[OrganisationRepository, Depends(get_organisation_repository)]
