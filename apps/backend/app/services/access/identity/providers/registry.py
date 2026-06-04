from __future__ import annotations

from app.services.access.identity.providers.base import LoginProvider


class LoginProviderRegistry:
    """Owns the set of enabled login providers for the running app.

    PoC wires exactly `[PasswordLoginProvider]`. MVP adds OIDC providers by
    appending implementations of the same Protocol — no route rewrite.
    """

    def __init__(self, providers: list[LoginProvider]) -> None:
        self._providers = providers

    def list(self) -> list[LoginProvider]:
        return list(self._providers)

    def get(self, key: str) -> LoginProvider | None:
        return next((p for p in self._providers if p.key == key), None)
