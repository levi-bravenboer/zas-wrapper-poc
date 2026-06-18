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

from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.access.identity.audit import AuthFailureReason
from app.services.access.identity.errors import InvalidCredentialsError
from app.services.access.identity.kratos_client import KratosClient


@dataclass(frozen=True)
class AuthenticatedUser:
    """Result of a successful login bound to exactly one role row.

    Carries the loaded `User`, the surface that authenticated, and the
    Kratos session token that becomes the session cookie value.
    """

    user: User
    surface: Literal["caregiver", "mobile", "admin"]
    session_token: str
    session_id: str


@dataclass(frozen=True)
class RoleSelectionPending:
    """Credentials verified, but the human holds several role rows on this
    surface (REQ-NON-3): the session is live yet unbound — protected routes
    answer 409 until `POST /auth/session/role` writes the binding.
    """

    roster: list[User]
    surface: Literal["caregiver", "mobile", "admin"]
    session_token: str
    session_id: str


async def authenticate_password(
    *,
    email: str,
    password: str,
    tenant_id: UUID,
    user_filter: Callable[[User], bool],
    surface: Literal["caregiver", "mobile", "admin"],
    user_repo: UserRepository,
    kratos: KratosClient,
) -> AuthenticatedUser | RoleSelectionPending:
    """Verify `email + password` via Kratos, gated by the local `users` rows.

    Raises `InvalidCredentialsError` for every failure mode (unknown email,
    inactive user, soft-deleted user, role rejected by `role_filter`, wrong
    password). The error never leaks which mode triggered; the per-cause
    `AuthFailureReason` is logged via the audit log helper, not returned.

    The Kratos login flow runs on every call — including paths that reject
    on local-row grounds — so response time does not vary by failure cause.
    A session minted for a locally-rejected login is revoked before raising.

    ``user_filter`` narrows the roster to the rows valid for this surface:
    the caregiver surface passes ``lambda u: u.patient_id is None`` (staff
    rows), mobile passes ``lambda u: u.patient_id is not None`` (the patient
    row). Identity-type is derived from data, not a role (`rbac-roles`).

    Multi-role (REQ-NON-3): one email can map to several rows; the eligible
    rows (active, not deleted, accepted by ``user_filter``) form the roster.
    One row → bound login (unchanged contract); several →
    `RoleSelectionPending` with the live-but-unbound session.
    """

    login = await kratos.login_with_password(email=email, password=password)
    rows = await user_repo.list_by_email(tenant_id, email)

    roster = [u for u in rows if u.deleted_at is None and u.is_active and user_filter(u)]

    reason: AuthFailureReason | None = None
    if not roster:
        # Derive the most specific reason from the rejected rows (audit only;
        # the raised error never leaks which mode triggered).
        if not rows:
            reason = "unknown_email"
        elif any(u.deleted_at is not None for u in rows):
            reason = "soft_deleted_user"
        elif any(not u.is_active for u in rows):
            reason = "inactive_user"
        else:
            reason = "role_mismatch"

    if reason is not None or login is None:
        if login is not None:
            # Kratos accepted but the local rows gate this surface — kill
            # the session so nothing live leaks out of a rejected login.
            await kratos.logout(session_token=login.session_token)
        raise InvalidCredentialsError(
            audit_reason=reason or "invalid_credentials",
            audit_user_id=rows[0].id if rows else None,
        )

    if len(roster) > 1:
        return RoleSelectionPending(
            roster=roster,
            surface=surface,
            session_token=login.session_token,
            session_id=login.session_id,
        )
    return AuthenticatedUser(
        user=roster[0],
        surface=surface,
        session_token=login.session_token,
        session_id=login.session_id,
    )
