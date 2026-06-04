from __future__ import annotations

from dataclasses import dataclass

from pydantic import SecretStr

from app.schemas.auth.auth import SessionUser
from app.services.access.identity.authenticator import AuthFailureReason, Authenticator
from app.services.access.identity.errors import InvalidCredentialsError
from app.services.access.identity.providers.base import ProviderKind


@dataclass(frozen=True)
class PasswordLoginOutcome:
    """Provider-facing login result.

    `session_user` is set on success; `reason` is set on failure. `user_id`
    is populated whenever the email mapped to a row (even if the password
    was wrong / the user was inactive / the row had no password hash) so
    the audit log can record the identity without leaking it to the caller.
    """

    session_user: SessionUser | None
    reason: AuthFailureReason | None
    user_id: str | None


class PasswordLoginProvider:
    key: str = "password"
    label: str = "E-mail + wachtwoord"
    kind: ProviderKind = "password"

    def __init__(self, authenticator: Authenticator) -> None:
        self._authenticator = authenticator

    async def authenticate(self, *, email: str, password: SecretStr) -> SessionUser:
        outcome = await self.try_authenticate(email=email, password=password)
        if outcome.session_user is None:
            raise InvalidCredentialsError()
        return outcome.session_user

    async def try_authenticate(self, *, email: str, password: SecretStr) -> PasswordLoginOutcome:
        result = await self._authenticator.authenticate(
            email=email, password=password.get_secret_value()
        )
        user_id = str(result.user.id) if result.user is not None else None
        if result.reason is not None or result.user is None:
            return PasswordLoginOutcome(session_user=None, reason=result.reason, user_id=user_id)
        return PasswordLoginOutcome(
            session_user=SessionUser.model_validate(result.user),
            reason=None,
            user_id=user_id,
        )
