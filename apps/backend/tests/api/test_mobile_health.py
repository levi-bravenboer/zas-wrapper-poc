from __future__ import annotations

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.main import create_app
from tests._settings import build_settings


def _client() -> TestClient:
    settings = build_settings(session_secret_key=SecretStr("test-secret"))
    return TestClient(create_app(settings))


def test_mobile_health_returns_ok() -> None:
    """`GET /mobile/health` is the seed endpoint for the digital-front-door app."""
    client = _client()
    response = client.get("/mobile/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_mobile_health_tagged_for_openapi() -> None:
    """The endpoint must surface under the `mobile` tag so the prefix is visible in OpenAPI."""
    client = _client()
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    health = spec["paths"]["/mobile/health"]["get"]
    assert "mobile" in health["tags"]
