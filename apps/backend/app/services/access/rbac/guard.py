"""Privilege-escalation guards for role management (D7 / D7a).

Admin-capability is defined by holding `patient.accessAll` (the crown the
seeded `admin` role carries) — not by a slug literal, so a renamed admin role
still works. Enforced in the service layer, not just routers.
"""

from __future__ import annotations

from collections.abc import Iterable

from app.core.enums.permission import CROWN_PERMISSIONS, Permission
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.errors import PrivilegeEscalationError

ADMIN_ROLE_SLUG = "admin"
DEFAULT_ROLE_SLUG = "default"

_CROWN: frozenset[str] = frozenset(str(p) for p in CROWN_PERMISSIONS)


def is_admin_capable(actor: SessionUser) -> bool:
    return Permission.PATIENT_ACCESS_ALL.value in actor.permissions


def assert_can_grant(actor: SessionUser, granting: Iterable[str]) -> None:
    """Editing a role: no amplification + crown permissions admin-only (D7)."""
    if is_admin_capable(actor):
        return
    requested = frozenset(granting)
    if requested & _CROWN:
        raise PrivilegeEscalationError()
    if not requested <= actor.permissions:
        raise PrivilegeEscalationError()


def assert_can_assign_role(
    actor: SessionUser, *, target_role_slug: str, target_role_permissions: Iterable[str]
) -> None:
    """Assigning a user to a role: crown floor — the `admin` role or any role
    holding a crown permission is admin-only to assign. Normal roles need only
    the assign permission (checked at the route), no subset check (D7a)."""
    if is_admin_capable(actor):
        return
    if target_role_slug == ADMIN_ROLE_SLUG or (frozenset(target_role_permissions) & _CROWN):
        raise PrivilegeEscalationError()


def assert_can_edit_system_role(actor: SessionUser, *, is_system: bool) -> None:
    if is_system and not is_admin_capable(actor):
        raise PrivilegeEscalationError()
