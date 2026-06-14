from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_no_appointments_routes_in_app() -> None:
    appointment_paths = [
        path
        for path in (getattr(route, "path", "") for route in app.routes)
        if path.startswith("/appointments")
    ]
    assert appointment_paths == [], f"Expected no /appointments routes; found: {appointment_paths}"


def test_no_appointments_in_openapi() -> None:
    client = TestClient(app)
    schema = client.get("/openapi.json").json()
    appointment_paths = [
        path for path in schema.get("paths", {}) if path.startswith("/appointments")
    ]
    assert appointment_paths == []


def test_no_appointment_service_module() -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.services.appointment.appointment_service")


def test_no_appointment_repository_module() -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.repositories.appointment_repository")


def test_no_hix_appointment_adapter_module() -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.adapters.hix.appointments")
