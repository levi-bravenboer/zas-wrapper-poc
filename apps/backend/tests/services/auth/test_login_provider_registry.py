from __future__ import annotations

from app.services.auth.providers import (
    LoginProvider,
    LoginProviderRegistry,
    PasswordLoginProvider,
)


def test_registry_lists_password_provider_in_poc() -> None:
    provider = PasswordLoginProvider(authenticator=_NullAuthenticator())
    registry = LoginProviderRegistry([provider])

    entries = registry.list()

    assert len(entries) == 1
    assert entries[0].key == "password"
    assert entries[0].kind == "password"


def test_registry_get_by_key() -> None:
    provider = PasswordLoginProvider(authenticator=_NullAuthenticator())
    registry = LoginProviderRegistry([provider])

    assert registry.get("password") is provider
    assert registry.get("missing") is None


def test_password_provider_satisfies_protocol() -> None:
    provider = PasswordLoginProvider(authenticator=_NullAuthenticator())
    assert isinstance(provider, LoginProvider)


class _NullAuthenticator:
    async def authenticate(
        self, *, email: str, password: str
    ):  # pragma: no cover - never called in registry tests
        del email, password
        from app.services.auth.authenticator import AuthenticationResult

        return AuthenticationResult(user=None, reason="unknown_email")
