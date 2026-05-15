"""Conformance: every concrete `TenantOwnedEntity` declares `__realtime_resource__`."""

from __future__ import annotations

import pytest

# Import the models package so every concrete subclass is registered on
# `TenantOwnedEntity.__subclasses__()` before introspection runs.
import app.db.models  # noqa: F401
from app.db.base import TenantOwnedEntity


def _all_subclasses(cls: type) -> set[type]:
    seen: set[type] = set()
    stack = list(cls.__subclasses__())
    while stack:
        sub = stack.pop()
        if sub in seen:
            continue
        seen.add(sub)
        stack.extend(sub.__subclasses__())
    return seen


def test_concrete_tenant_owned_entities_declare_realtime_resource() -> None:
    concrete = [
        cls
        for cls in _all_subclasses(TenantOwnedEntity)
        if not cls.__dict__.get("__abstract__", False)
    ]

    offenders = [cls for cls in concrete if "__realtime_resource__" not in cls.__dict__]
    if offenders:
        names = ", ".join(f"{cls.__module__}.{cls.__name__}" for cls in offenders)
        pytest.fail(
            "TenantOwnedEntity subclasses must declare `__realtime_resource__` "
            f"in their class body (value may be None): {names}"
        )

    # Vacuous pass acceptable if no concrete subclasses exist yet.
    assert len(concrete) >= 0
