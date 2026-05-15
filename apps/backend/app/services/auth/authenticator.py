from __future__ import annotations

from typing import Protocol
from uuid import UUID

from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.auth.password import PasswordHasher


class Authenticator(Protocol):
    async def authenticate(self, *, email: str, password: str) -> User | None: ...


class PasswordAuthenticator:
    """Email + password authenticator backed by `UserRepository` + argon2.

    PoC is single-tenant: callers wire `tenant_id` once via the factory
    (`scripts.seed_tenant.ZAS_TENANT_ID`). Multi-tenant resolution (e.g.,
    from the request host) lands when MVP introduces a second tenant.
    Returns `None` on missing email, inactive user, or mismatched password.
    """

    def __init__(
        self,
        repo: UserRepository,
        hasher: PasswordHasher,
        *,
        tenant_id: UUID,
    ) -> None:
        self._repo = repo
        self._hasher = hasher
        self._tenant_id = tenant_id

    async def authenticate(self, *, email: str, password: str) -> User | None:
        user = await self._repo.get_by_email(self._tenant_id, email)
        if user is None or not user.is_active:
            return None
        if not self._hasher.verify(user.password_hash, password):
            return None
        return user
