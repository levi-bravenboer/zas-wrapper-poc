from __future__ import annotations

from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)


class PasswordHasher:
    """Thin wrapper around `argon2.PasswordHasher`.

    Narrow interface keeps the dependency swappable and the call sites in
    `AuthService` / `PasswordAuthenticator` testable via fakes.
    """

    def __init__(self) -> None:
        self._hasher = Argon2Hasher()

    def hash(self, plain: str) -> str:
        return self._hasher.hash(plain)

    def verify(self, hashed: str, plain: str) -> bool:
        try:
            return self._hasher.verify(hashed, plain)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False
