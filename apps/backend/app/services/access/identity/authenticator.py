from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol
from uuid import UUID

from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.access.identity.kratos_client import KratosClient
from app.services.access.identity.password import PasswordHasher

AuthFailureReason = Literal[
    "unknown_email",
    "inactive_user",
    "null_password_hash",
    "invalid_credentials",
]


@dataclass(frozen=True)
class AuthenticationResult:
    user: User | None
    reason: AuthFailureReason | None
    # Kratos session token on success — becomes the session cookie value.
    session_token: str | None = None

    @property
    def ok(self) -> bool:
        return self.user is not None and self.reason is None


class Authenticator(Protocol):
    async def authenticate(self, *, email: str, password: str) -> AuthenticationResult: ...


class KratosAuthenticator:
    """Credential verification delegated to Ory Kratos.

    The local `users` row is still loaded (and gates the outcome — missing,
    inactive rows fail) but the password itself is only ever checked by
    Kratos. Failure causes map onto the same `AuthFailureReason` vocabulary
    so the audit log keeps its distinctions; callers never learn which.
    """

    def __init__(
        self,
        repo: UserRepository,
        kratos: KratosClient,
        *,
        tenant_id: UUID,
    ) -> None:
        self._repo = repo
        self._kratos = kratos
        self._tenant_id = tenant_id

    async def authenticate(self, *, email: str, password: str) -> AuthenticationResult:
        user = await self._repo.get_by_email(self._tenant_id, email)
        if user is None:
            return AuthenticationResult(user=None, reason="unknown_email")
        if not user.is_active:
            return AuthenticationResult(user=None, reason="inactive_user")

        login = await self._kratos.login_with_password(email=email, password=password)
        if login is None:
            return AuthenticationResult(user=user, reason="invalid_credentials")
        return AuthenticationResult(user=user, reason=None, session_token=login.session_token)


class PasswordAuthenticator:
    """Email + password authenticator backed by `UserRepository` + argon2.

    PoC is single-tenant: callers wire `tenant_id` once via the factory
    (`scripts.seed_tenant.ZAS_TENANT_ID`). Multi-tenant resolution (e.g.,
    from the request host) lands when MVP introduces a second tenant.
    Returns an `AuthenticationResult` whose `reason` lets the auth audit log
    distinguish unknown email, inactive user, externally-authenticated row,
    or wrong password without leaking the distinction back to the caller.

    `mobile-app-auth-setup` adds a parallel `authenticate_password()` service
    at `app.services.access.identity.login_service` for the mobile surface, which uses
    per-request `tenant_id` resolution and a role filter. Both paths read
    from the same `UserRepository`; the verifier is `PasswordHasher` in
    both. A caregiver migration to the shared service is deferred to a
    follow-up change to keep blast radius small.
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

    async def authenticate(self, *, email: str, password: str) -> AuthenticationResult:
        user = await self._repo.get_by_email(self._tenant_id, email)
        if user is None:
            return AuthenticationResult(user=None, reason="unknown_email")
        if not user.is_active:
            return AuthenticationResult(user=None, reason="inactive_user")
        # Externally-authenticated rows (e.g. eID-only) have no password.
        if user.password_hash is None:
            return AuthenticationResult(user=None, reason="null_password_hash")
        if not self._hasher.verify(user.password_hash, password):
            return AuthenticationResult(user=user, reason="invalid_credentials")
        return AuthenticationResult(user=user, reason=None)
