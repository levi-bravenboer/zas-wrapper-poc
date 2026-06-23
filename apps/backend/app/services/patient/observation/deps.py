from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.services.patient.observation.observation_service import ObservationService


def get_observation_service(session: SessionDep) -> ObservationService:
    return ObservationService(session)


ObservationServiceDep = Annotated[ObservationService, Depends(get_observation_service)]
