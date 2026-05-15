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

    async def get(self, actor: SessionUser, target_user_id: UUID) -> User:
        user = await self._repo.get_by_id(target_user_id)
        if user is None:
            raise UserNotFoundError()
        if user.tenant_id != actor.tenant_id:
            raise CrossTenantAccessError()
        return user

    async def assign_role(self, actor: SessionUser, target_user_id: UUID, role: Role) -> User:
        user = await self.get(actor, target_user_id)
        user.role = role
        return await self._repo.update(user)

    async def set_active(
        self, actor: SessionUser, target_user_id: UUID, *, is_active: bool
    ) -> User:
        user = await self.get(actor, target_user_id)
        user.is_active = is_active
        return await self._repo.update(user)
