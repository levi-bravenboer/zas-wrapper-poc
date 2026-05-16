from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.services.practitioner.practitioner_service import PractitionerService


def get_practitioner_service(session: SessionDep) -> PractitionerService:
    return PractitionerService(session)


PractitionerServiceDep = Annotated[PractitionerService, Depends(get_practitioner_service)]
