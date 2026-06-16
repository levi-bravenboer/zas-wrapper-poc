from __future__ import annotations

import app.db.models  # noqa: F401  (register all mappers)
from app.services.audit.registry import is_known_resource, known_resource_types


def test_known_models_recognised() -> None:
    names = known_resource_types()
    assert "Patient" in names
    assert "User" in names


def test_unknown_resource_rejected() -> None:
    assert is_known_resource("Patient") is True
    assert is_known_resource("Nonexistent") is False
