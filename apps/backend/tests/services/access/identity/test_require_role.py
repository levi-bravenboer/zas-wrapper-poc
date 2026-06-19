from __future__ import annotations

import uuid

import pytest

from app.core.enums import Permission
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.errors import ForbiddenPermissionError
from app.services.access.rbac.deps import require_permission
from tests._rbac import make_session_user


def _actor(*permissions: str) -> SessionUser:
    return make_session_user(
        tenant_id=uuid.uuid4(),
        email="actor@example.test",
        display_name="actor",
        permissions=frozenset(permissions),
    )


def test_single_permission_allows_match() -> None:
    guard = require_permission(Permission.PATIENT_ACCESS_ALL)
    actor = _actor(Permission.PATIENT_ACCESS_ALL.value)
    assert guard(actor) is actor


def test_single_permission_denies_mismatch() -> None:
    guard = require_permission(Permission.PATIENT_ACCESS_ALL)
    with pytest.raises(ForbiddenPermissionError):
        guard(_actor(Permission.BREAK_GLASS_REQUEST.value))


def test_any_of_many_allowed() -> None:
    guard = require_permission(Permission.PATIENT_ACCESS_ALL, Permission.BREAK_GLASS_REQUEST)
    assert guard(_actor(Permission.PATIENT_ACCESS_ALL.value)) is not None
    assert guard(_actor(Permission.BREAK_GLASS_REQUEST.value)) is not None


def test_empty_varargs_raises_at_wiring_time() -> None:
    with pytest.raises(ValueError):
        require_permission()
