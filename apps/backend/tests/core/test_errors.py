from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, SecretStr

from app.core.errors import AppError
from app.main import create_app
from tests._settings import build_settings


class InvalidCredentialsError(AppError):
    code = "security.auth.invalid_credentials"
    status_code = 401
    message = "Invalid credentials."


class _LoginBody(BaseModel):
    username: str
    password: str


def _build_app() -> TestClient:
    settings = build_settings(session_secret_key=SecretStr("test-secret"))
    app = create_app(settings)

    router = APIRouter()

    @router.post("/_test/login")
    def _login(body: _LoginBody) -> dict[str, str]:
        del body
        raise InvalidCredentialsError()

    @router.get("/_test/missing")
    def _missing() -> None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not-found.fhir.patient", "message": "Patient not found"},
        )

    @router.get("/_test/legacy")
    def _legacy() -> None:
        raise HTTPException(status_code=418, detail="i am a teapot")

    app.include_router(router)
    return TestClient(app)


def test_app_error_subclass_mapped_to_error_response() -> None:
    client = _build_app()
    response = client.post("/_test/login", json={"username": "x", "password": "y"})
    assert response.status_code == 401
    body = response.json()
    assert body == {
        "code": "security.auth.invalid_credentials",
        "message": "Invalid credentials.",
        "details": None,
    }


def test_http_exception_with_structured_detail_mapped() -> None:
    client = _build_app()
    response = client.get("/_test/missing")
    assert response.status_code == 404
    assert response.json() == {
        "code": "not-found.fhir.patient",
        "message": "Patient not found",
        "details": None,
    }


def test_http_exception_with_string_detail_falls_back() -> None:
    client = _build_app()
    response = client.get("/_test/legacy")
    assert response.status_code == 418
    body = response.json()
    assert body["code"] == "processing.http.418"
    assert body["message"] == "i am a teapot"


def test_validation_error_mapped() -> None:
    client = _build_app()
    response = client.post("/_test/login", json={"username": "only-user"})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "invalid.validation.body"
    assert body["message"] == "Request body failed validation"
    assert "errors" in body["details"]
    assert isinstance(body["details"]["errors"], list)
