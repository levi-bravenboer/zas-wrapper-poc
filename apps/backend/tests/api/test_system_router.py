from __future__ import annotations

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.main import create_app
from tests._settings import build_settings


def _client() -> TestClient:
    settings = build_settings(session_secret_key=SecretStr("test-secret"))
    return TestClient(create_app(settings))


def test_root_returns_metadata() -> None:
    client = _client()
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "ZAS Wrapper Backend"
    assert payload["version"]


def test_health_returns_health_response_shape() -> None:
    client = _client()
    response = client.get("/healthz")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"]
    assert payload["started_at"]


def test_ready_returns_ready_when_all_adapter_pings_succeed() -> None:
    # No Luscii token in test settings ⇒ no luscii readiness entry.
    client = _client()
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "checks": {"hix": "ok"}}


def test_luscii_readiness_registered_only_when_token_configured() -> None:
    unconfigured = create_app(build_settings(session_secret_key=SecretStr("test-secret")))
    assert "luscii" not in unconfigured.state.readiness.names()
    assert unconfigured.state.luscii_client is None

    configured = create_app(
        build_settings(
            session_secret_key=SecretStr("test-secret"),
            luscii_api_token=SecretStr("test-token"),
        )
    )
    assert "luscii" in configured.state.readiness.names()
    assert configured.state.luscii_client is not None


def test_ready_returns_503_when_check_fails() -> None:
    settings = build_settings(session_secret_key=SecretStr("test-secret"))
    app = create_app(settings)

    async def _fail_ping() -> None:
        raise RuntimeError("boom")

    async def _ok_ping() -> None:
        return None

    app.state.readiness.register("hix", _fail_ping)
    app.state.readiness.register("luscii", _ok_ping)

    client = TestClient(app)
    response = client.get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "not_ready"
    assert body["checks"] == {"hix": "fail", "luscii": "ok"}
