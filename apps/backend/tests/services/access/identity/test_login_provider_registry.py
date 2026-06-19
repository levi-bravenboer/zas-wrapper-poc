from __future__ import annotations

from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from app.services.access.identity.providers import (
    LoginProvider,
    LoginProviderRegistry,
    PasswordLoginProvider,
)


def test_registry_lists_password_provider_in_poc() -> None:
    provider = PasswordLoginProvider(_NullAuthenticator(), cast("AsyncSession", None))
    registry = LoginProviderRegistry([provider])

    entries = registry.list()

    assert len(entries) == 1
    assert entries[0].key == "password"
    assert entries[0].kind == "password"


def test_registry_get_by_key() -> None:
    provider = PasswordLoginProvider(_NullAuthenticator(), cast("AsyncSession", None))
    registry = LoginProviderRegistry([provider])

    assert registry.get("password") is provider
    assert registry.get("missing") is None


def test_password_provider_satisfies_protocol() -> None:
    provider = PasswordLoginProvider(_NullAuthenticator(), cast("AsyncSession", None))
    assert isinstance(provider, LoginProvider)


class _NullAuthenticator:
    async def authenticate(
        self, *, email: str, password: str
    ):  # pragma: no cover - never called in registry tests
        del email, password
        from app.services.access.identity.authenticator import AuthenticationResult

        return AuthenticationResult(user=None, reason="unknown_email")
