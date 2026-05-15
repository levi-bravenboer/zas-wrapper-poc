from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.repositories.user.deps import UserRepoDep
from app.services.user.user_service import UserService


def get_user_service(repo: UserRepoDep) -> UserService:
    return UserService(repo)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]
