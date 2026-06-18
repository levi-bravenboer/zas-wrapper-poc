"""`require_permission(...)` — the RBAC route guard replacing `require_role`.

Any-of semantics: the caller must hold at least one of the listed slugs (most
routes pass a single slug). Patient-DATA routes do NOT use this — they stay
authenticated + Keto (design D12). The Keto bypass is the `patient.accessAll`
permission, checked in `app/services/patient/deps.py`.
"""

from __future__ import annotations

from collections.abc import Callable

from app.core.enums.permission import Permission
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import CurrentUserDep
from app.services.access.identity.errors import ForbiddenPermissionError


def require_permission(*slugs: str | Permission) -> Callable[[SessionUser], SessionUser]:
    if not slugs:
        raise ValueError("require_permission requires at least one permission")
    needed: frozenset[str] = frozenset(str(s) for s in slugs)

    def _guard(current_user: CurrentUserDep) -> SessionUser:
        if needed.isdisjoint(current_user.permissions):
            raise ForbiddenPermissionError()
        return current_user

    return _guard
