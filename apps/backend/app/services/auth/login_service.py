"""Shared password verification service for caregiver + mobile surfaces.

Both `POST /auth/login/password` and `POST /mobile/auth/login/password` go
through `authenticate_password()` so password verification, audit logging,
user-disabled handling, soft-delete handling, and timing-safe rejection
live in one place. Each surface differs only in the `role_filter` it
passes and (for mobile) the per-request `tenant_id` it resolves.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from app.core.enums.user import Role
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.services.auth.audit import AuthFailureReason
from app.services.auth.errors import InvalidCredentialsError
from app.services.auth.password import PasswordHasher


@dataclass(frozen=True)
class AuthenticatedUser:
    """Result of a successful password verification.

    Carries the loaded `User` and the surface that authenticated.
    """

    user: User
    surface: Literal["caregiver", "mobile", "admin"]


# A dummy argon2 hash so the verifier runs even on rejection paths. The
# specific value is irrelevant — argon2 verification just needs a parseable
# encoded hash to spend the same wall-clock time it would on a real one.
_DUMMY_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$"
    "AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
)


async def authenticate_password(
    *,
    email: str,
    password: str,
    tenant_id: UUID,
    role_filter: Callable[[Role], bool],
    surface: Literal["caregiver", "mobile", "admin"],
    user_repo: UserRepository,
    hasher: PasswordHasher,
) -> AuthenticatedUser:
    """Verify `email + password` against the `users` table.

    Raises `InvalidCredentialsError` for every failure mode (unknown
    email, inactive user, soft-deleted user, null password hash, role
    rejected by `role_filter`, password mismatch). The error never leaks
    which mode triggered; per-cause `AuthFailureReason` is logged via the
    audit log helper, not returned.

    Runs the password verifier even when the caller would short-circuit
    (user not found, inactive, role-mismatch) so the response time does
    not differ between failure causes.
    """

    user = await user_repo.get_by_email(tenant_id, email)

    reason: AuthFailureReason | None = None
    if user is None:
        reason = "unknown_email"
    elif user.deleted_at is not None:
        reason = "soft_deleted_user"
    elif not user.is_active:
        reason = "inactive_user"
    elif user.password_hash is None:
        reason = "null_password_hash"
    elif not role_filter(user.role):
        reason = "role_mismatch"

    if reason is not None:
        # Constant-time guard: spend the same wall-clock time as a real
        # verify call to avoid leaking the failure cause via timing.
        hasher.verify(_DUMMY_HASH, password)
        raise InvalidCredentialsError(
            audit_reason=reason,
            audit_user_id=user.id if user is not None else None,
        )

    assert user is not None and user.password_hash is not None
    if not hasher.verify(user.password_hash, password):
        raise InvalidCredentialsError(
            audit_reason="invalid_credentials",
            audit_user_id=user.id,
        )

    return AuthenticatedUser(user=user, surface=surface)
