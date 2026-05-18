from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.user.deps import UserRepoDep
from app.services.auth.deps import PasswordHasherDep
from app.services.practitioner.deps import PractitionerServiceDep
from app.services.user.user_service import UserService


def get_user_service(
    session: SessionDep,
    repo: UserRepoDep,
    practitioner_service: PractitionerServiceDep,
    hasher: PasswordHasherDep,
) -> UserService:
    return UserService(session, repo, practitioner_service, hasher)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]
