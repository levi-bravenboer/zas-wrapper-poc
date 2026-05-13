from fastapi.testclient import TestClient
from pydantic import AnyHttpUrl, SecretStr

from app.core.settings import Settings
from app.main import create_app

DEV_ORIGIN = "http://localhost:5173"
UNKNOWN_ORIGIN = "http://evil.example.com"


def _build_client(origins: list[str]) -> TestClient:
    settings = Settings(
        _env_file=None,
        cors_origins=[AnyHttpUrl(o) for o in origins],
        session_secret_key=SecretStr("test-secret"),
    )
    return TestClient(create_app(settings))


def test_cors_allows_known_origin_preflight() -> None:
    client = _build_client([DEV_ORIGIN])
    response = client.options(
        "/health",
        headers={
            "Origin": DEV_ORIGIN,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == DEV_ORIGIN
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_rejects_unknown_origin_preflight() -> None:
    client = _build_client([DEV_ORIGIN])
    response = client.options(
        "/health",
        headers={
            "Origin": UNKNOWN_ORIGIN,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in {k.lower() for k in response.headers}
