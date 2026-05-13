from __future__ import annotations

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8  # 8h


class SessionSigner:
    """Signs and verifies short opaque tokens carrying a user id.

    Backed by `itsdangerous.URLSafeTimedSerializer` so cookies can include a
    timestamp without an explicit datetime field.
    """

    def __init__(self, secret_key: str, salt: str = "zas.session.v1") -> None:
        self._serializer = URLSafeTimedSerializer(secret_key, salt=salt)

    def sign(self, user_id: str) -> str:
        return self._serializer.dumps(user_id)

    def unsign(
        self, token: str, max_age_seconds: int = DEFAULT_SESSION_MAX_AGE_SECONDS
    ) -> str | None:
        try:
            value = self._serializer.loads(token, max_age=max_age_seconds)
        except (BadSignature, SignatureExpired):
            return None
        return value if isinstance(value, str) else None
