from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.settings import Settings
from app.main import create_app
from tests._settings import build_settings


@pytest.fixture
def settings() -> Settings:
    return build_settings(session_secret_key=SecretStr("test-secret"))


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def authed_client(client: TestClient) -> TestClient:
    response = client.post("/auth/login", json={"username": "clinician", "password": "demo"})
    assert response.status_code == 200, response.text
    return client
