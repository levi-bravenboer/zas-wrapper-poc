from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.practitioner_role.practitioner_role_repository import (
    PractitionerRoleRepository,
)


def get_practitioner_role_repository(session: SessionDep) -> PractitionerRoleRepository:
    return PractitionerRoleRepository(session)


PractitionerRoleRepoDep = Annotated[
    PractitionerRoleRepository, Depends(get_practitioner_role_repository)
]
