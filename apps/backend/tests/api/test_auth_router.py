from __future__ import annotations

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.main import create_app
from tests._settings import build_settings


def _client() -> TestClient:
    settings = build_settings(session_secret_key=SecretStr("test-secret"))
    return TestClient(create_app(settings))


def test_login_success_sets_cookie() -> None:
    client = _client()
    response = client.post("/auth/login", json={"username": "clinician", "password": "demo"})
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "clinician"
    assert body["display_name"] == "Demo Clinician"
    assert "BACKEND_SESSION" in response.cookies


def test_login_failure_returns_401() -> None:
    client = _client()
    response = client.post("/auth/login", json={"username": "clinician", "password": "wrong"})
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "auth.invalid_credentials"
    assert "BACKEND_SESSION" not in client.cookies


def test_me_with_cookie_returns_user() -> None:
    client = _client()
    client.post("/auth/login", json={"username": "clinician", "password": "demo"})
    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == "clinician"


def test_me_without_cookie_returns_401() -> None:
    client = _client()
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "auth.unauthenticated"


def test_me_with_tampered_cookie_returns_401() -> None:
    client = _client()
    client.cookies.set("BACKEND_SESSION", "tampered.cookie.value")
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["code"] == "auth.unauthenticated"


def test_logout_clears_cookie() -> None:
    client = _client()
    client.post("/auth/login", json={"username": "clinician", "password": "demo"})
    assert "BACKEND_SESSION" in client.cookies

    response = client.post("/auth/logout")
    assert response.status_code == 204
    # subsequent /me call should be 401
    me = client.get("/auth/me")
    assert me.status_code == 401
