from __future__ import annotations

from typing import Literal, Protocol, runtime_checkable

from pydantic import SecretStr

from app.schemas.auth.auth import SessionUser

ProviderKind = Literal["password", "oidc"]


@runtime_checkable
class LoginProvider(Protocol):
    """Owns the route shape for one login mechanism.

    PoC ships exactly one implementation (`PasswordLoginProvider`); MVP adds
    OIDC providers via the same Protocol. The `Authenticator` Protocol stays
    one layer below for the credential check itself.
    """

    key: str
    label: str
    kind: ProviderKind

    async def authenticate(self, *, email: str, password: SecretStr) -> SessionUser: ...
