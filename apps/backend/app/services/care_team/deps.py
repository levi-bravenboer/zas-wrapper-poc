from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.services.care_team.care_team_service import CareTeamService


def get_care_team_service(session: SessionDep) -> CareTeamService:
    return CareTeamService(session)


CareTeamServiceDep = Annotated[CareTeamService, Depends(get_care_team_service)]
