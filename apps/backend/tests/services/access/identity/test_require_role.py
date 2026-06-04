from __future__ import annotations

import uuid

import pytest

from app.core.enums.user import Role
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.access.identity.errors import ForbiddenRoleError


def _actor(role: Role) -> SessionUser:
    return SessionUser(
        id=uuid.uuid4(),
        email="actor@example.test",
        display_name="actor",
        tenant_id=uuid.uuid4(),
        role=role,
    )


def test_single_role_allows_match() -> None:
    guard = require_role(Role.ADMIN)
    assert guard(_actor(Role.ADMIN)).role is Role.ADMIN


def test_single_role_denies_mismatch() -> None:
    guard = require_role(Role.ADMIN)
    with pytest.raises(ForbiddenRoleError):
        guard(_actor(Role.CAREGIVER))


def test_any_of_many_allowed() -> None:
    guard = require_role(Role.ADMIN, Role.CAREGIVER)
    assert guard(_actor(Role.ADMIN)).role is Role.ADMIN
    assert guard(_actor(Role.CAREGIVER)).role is Role.CAREGIVER


def test_empty_varargs_raises_at_wiring_time() -> None:
    with pytest.raises(ValueError):
        require_role()
