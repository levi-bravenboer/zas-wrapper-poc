from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe `users` + `tenants` around every auth service test."""
