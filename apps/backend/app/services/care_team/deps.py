from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.organisation.deps import OrganisationRepoDep
from app.services.care_team.care_team_service import CareTeamService


def get_care_team_service(
    session: SessionDep, organisation_repo: OrganisationRepoDep
) -> CareTeamService:
    return CareTeamService(session, organisation_repo)


CareTeamServiceDep = Annotated[CareTeamService, Depends(get_care_team_service)]
