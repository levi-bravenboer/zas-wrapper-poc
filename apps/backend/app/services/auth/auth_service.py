from __future__ import annotations

from uuid import UUID

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.settings import Settings
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.auth.authenticator import Authenticator
from app.services.auth.errors import InvalidCredentialsError, UnauthenticatedError

_SESSION_SALT = "session-cookie"


class AuthService:
    """Coordinates authentication, session token mint/verify, and current-user
    re-load on each request. The `Authenticator` Protocol is the swappable
    seam — `PasswordAuthenticator` today; `EidAuthenticator` at MVP.
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
        self._serializer = URLSafeTimedSerializer(
            settings.session_secret_key.get_secret_value(),
            salt=_SESSION_SALT,
        )

    async def login(self, *, email: str, password: str) -> SessionUser:
        result = await self._authenticator.authenticate(email=email, password=password)
        if result.user is None or result.reason is not None:
            raise InvalidCredentialsError()
        return _to_session_user(result.user)

    def mint_session_token(self, user_id: UUID) -> str:
        return self._serializer.dumps(str(user_id))

    def verify_session_token(self, token: str) -> UUID:
        try:
            raw = self._serializer.loads(token, max_age=self._settings.session_max_age_seconds)
        except SignatureExpired as exc:
            raise UnauthenticatedError(message="Session expired.") from exc
        except BadSignature as exc:
            raise UnauthenticatedError(message="Invalid session token.") from exc
        try:
            return UUID(str(raw))
        except (TypeError, ValueError) as exc:
            raise UnauthenticatedError(message="Malformed session token.") from exc

    async def load_session_user(self, user_id: UUID) -> SessionUser:
        user = await self._repo.get_by_id(user_id)
        if user is None or not user.is_active:
            raise UnauthenticatedError()
        return _to_session_user(user)


def _to_session_user(user: object) -> SessionUser:
    return SessionUser.model_validate(user)
