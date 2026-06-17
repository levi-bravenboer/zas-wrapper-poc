from __future__ import annotations

import pytest

from app.core.enums.user import Role
from app.schemas.auth.auth import SessionUser
from scripts.seed_tenant import ZAS_TENANT_ID
from scripts.seed_users import ADMIN_DISPLAY_NAME, ADMIN_EMAIL, ADMIN_USER_ID


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe tenant-scoped tables (incl. audit_events) around every test."""


@pytest.fixture
def session_actor() -> SessionUser:
    """Stamp rows + audit events with the bootstrap admin actor."""

    return SessionUser(
        id=ADMIN_USER_ID,
        email=ADMIN_EMAIL,
        display_name=ADMIN_DISPLAY_NAME,
        tenant_id=ZAS_TENANT_ID,
        role=Role.ADMIN,
    )
