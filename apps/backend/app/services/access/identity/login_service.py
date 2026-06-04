"""Shared login service for caregiver + mobile surfaces.

Both `POST /auth/login/password` and `POST /mobile/auth/login/password` go
through `authenticate_password()` so surface gating (role filter, soft-delete,
inactive), audit logging, and session minting live in one place. Since
`access-management-ory`, the password itself is verified by Ory Kratos —
the local row gates the outcome but `password_hash` is never consulted.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from app.core.enums.user import Role
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.access.identity.audit import AuthFailureReason
from app.services.access.identity.errors import InvalidCredentialsError
from app.services.access.identity.kratos_client import KratosClient


@dataclass(frozen=True)
class AuthenticatedUser:
    """Result of a successful login.

    Carries the loaded `User`, the surface that authenticated, and the
    Kratos session token that becomes the session cookie value.
    """

    user: User
    surface: Literal["caregiver", "mobile", "admin"]
    session_token: str


async def authenticate_password(
    *,
    email: str,
    password: str,
    tenant_id: UUID,
    role_filter: Callable[[Role], bool],
    surface: Literal["caregiver", "mobile", "admin"],
    user_repo: UserRepository,
    kratos: KratosClient,
    role: Role | None = None,
) -> AuthenticatedUser:
    """Verify `email + password` via Kratos, gated by the local `users` row.

    Raises `InvalidCredentialsError` for every failure mode (unknown email,
    inactive user, soft-deleted user, role rejected by `role_filter`, wrong
    password). The error never leaks which mode triggered; the per-cause
    `AuthFailureReason` is logged via the audit log helper, not returned.

    The Kratos login flow runs on every call — including paths that reject
    on local-row grounds — so response time does not vary by failure cause.
    A session minted for a locally-rejected login is revoked before raising.

    Pass ``role`` to narrow the DB lookup when email uniqueness is scoped to
    ``(tenant, email, role)`` — prevents ``MultipleResultsFound`` when a
    caregiver and patient share an email.
    """

    login = await kratos.login_with_password(email=email, password=password)
    user = await user_repo.get_by_email(tenant_id, email, role=role)

    reason: AuthFailureReason | None = None
    if user is None:
        reason = "unknown_email"
    elif user.deleted_at is not None:
        reason = "soft_deleted_user"
    elif not user.is_active:
        reason = "inactive_user"
    elif not role_filter(user.role):
        reason = "role_mismatch"

    if reason is not None or login is None:
        if login is not None:
            # Kratos accepted but the local row gates this surface — kill
            # the session so nothing live leaks out of a rejected login.
            await kratos.logout(session_token=login.session_token)
        raise InvalidCredentialsError(
            audit_reason=reason or "invalid_credentials",
            audit_user_id=user.id if user is not None else None,
        )

    assert user is not None
    return AuthenticatedUser(user=user, surface=surface, session_token=login.session_token)
