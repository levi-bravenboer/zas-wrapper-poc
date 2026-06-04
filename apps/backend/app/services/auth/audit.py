"""Structured login audit log.

GDPR Art 32 + eHealth deontological code require authentication-event
logging on regulated systems. PoC writes to stdout via the existing
JSON / human formatter; MVP (`BL-042`) promotes this to a queryable
`auth_audit` table.

Never log password material, cookie values, or unmatched email addresses.
`user_id` is set only when the credential mapped to a real row, so a
brute-force attempt against random addresses cannot enumerate users.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger("app.auth.audit")

AuthEventName = Literal["auth.login.success", "auth.login.failure", "auth.logout"]
AuthFailureReason = Literal[
    "invalid_credentials",
    "inactive_user",
    "soft_deleted_user",
    "null_password_hash",
    "unknown_email",
    "role_mismatch",
    "unknown_tenant",
]
AuthSurface = Literal["caregiver", "mobile", "admin"]


class AuthEvent(BaseModel):
    model_config = ConfigDict(frozen=True)

    event: AuthEventName
    provider_key: str
    surface: AuthSurface = "caregiver"
    client_ip: str | None = None
    user_agent: str | None = None
    user_id: UUID | None = None
    reason: AuthFailureReason | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


def log_auth_event(event: AuthEvent) -> None:
    payload = event.model_dump(mode="json", exclude_none=True)
    logger.info(event.event, extra=payload)
