from __future__ import annotations

from uuid import UUID

from app.core.enums.user import Role
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.user.errors import CrossTenantAccessError, UserNotFoundError


class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def list_in_tenant(self, tenant_id: UUID, *, active: bool | None = None) -> list[User]:
        return await self._repo.list_in_tenant(tenant_id, active=active)

    async def assign_role(self, actor: SessionUser, target_user_id: UUID, role: Role) -> User:
        user = await self._repo.get_by_id(target_user_id)
        if user is None:
            raise UserNotFoundError()
        if user.tenant_id != actor.tenant_id:
            raise CrossTenantAccessError()
        user.role = role
        return await self._repo.update(user)
