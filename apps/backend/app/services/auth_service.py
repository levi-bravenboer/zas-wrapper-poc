# POC ONLY — in-memory user store with plaintext demo credentials.
# Replace with real IdP integration before any non-PoC deployment.
from __future__ import annotations

from app.schemas.auth import SessionUser

_USERS: dict[str, SessionUser] = {
    "clinician": SessionUser(id="u-1", username="clinician", display_name="Demo Clinician"),
}

_PASSWORDS: dict[str, str] = {
    "clinician": "demo",
}


def authenticate(username: str, password: str) -> SessionUser | None:
    expected = _PASSWORDS.get(username)
    if expected is None or expected != password:
        return None
    return _USERS.get(username)


def get_user(user_id: str) -> SessionUser | None:
    for user in _USERS.values():
        if user.id == user_id:
            return user
    return None
