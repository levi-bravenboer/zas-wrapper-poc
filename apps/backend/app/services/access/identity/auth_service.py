from __future__ import annotations

from uuid import UUID

from app.core.settings import Settings
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.authenticator import Authenticator
from app.services.access.identity.errors import InvalidCredentialsError, UnauthenticatedError


class AuthService:
    """Coordinates authentication and current-user re-load on each request.

    Session minting and verification moved to Ory Kratos
    (`access-management-ory`): the cookie value IS the Kratos session token,
    verified per-request via `whoami` in `deps.resolve_actor_from_request`.
    The `Authenticator` Protocol stays the swappable credential seam —
    `KratosAuthenticator` in production, fakes in tests.
    """

    def __init__(
        self,
        authenticator: Authenticator,
        repo: UserRepository,
        settings: Settings,
    ) -> None:
        self._authenticator = authenticator
        self._repo = repo
        self._settings = settings

    async def login(self, *, email: str, password: str) -> SessionUser:
        result = await self._authenticator.authenticate(email=email, password=password)
        if result.user is None or result.reason is not None:
            raise InvalidCredentialsError()
        return _to_session_user(result.user)

    async def load_session_user(self, user_id: UUID) -> SessionUser:
        user = await self._repo.get_by_id(user_id)
        if user is None or not user.is_active:
            raise UnauthenticatedError()
        return _to_session_user(user)


def _to_session_user(user: object) -> SessionUser:
    return SessionUser.model_validate(user)
