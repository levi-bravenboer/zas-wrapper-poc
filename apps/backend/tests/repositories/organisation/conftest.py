from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe `organisations` + `users` + `tenants` around every org repo test."""
