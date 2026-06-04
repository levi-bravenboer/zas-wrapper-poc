from __future__ import annotations

import logging
from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.db.models.user import User
from scripts.seed_users import CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


def _audit_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == "app.auth.audit"]


async def test_login_success_emits_audit(
    async_client: AsyncClient,
    seeded_zas_users: list[User],
    caplog: pytest.LogCaptureFixture,
) -> None:
    del seeded_zas_users
    caplog.set_level(logging.INFO, logger="app.auth.audit")
    await async_client.post(
        "/auth/login/password",
        json={"email": CAREGIVER_EMAIL, "password": _DEFAULT_PASSWORD},
    )

    records = _audit_records(caplog)
    assert len(records) == 1
    assert records[0].getMessage() == "auth.login.success"
    assert getattr(records[0], "provider_key") == "password"
    assert getattr(records[0], "user_id") is not None
    assert getattr(records[0], "reason", None) is None


async def test_login_failure_with_known_email_records_user_id(
    async_client: AsyncClient,
    seeded_zas_users: list[User],
    caplog: pytest.LogCaptureFixture,
) -> None:
    del seeded_zas_users
    caplog.set_level(logging.INFO, logger="app.auth.audit")
    await async_client.post(
        "/auth/login/password", json={"email": CAREGIVER_EMAIL, "password": "wrong"}
    )

    records = _audit_records(caplog)
    assert len(records) == 1
    assert records[0].getMessage() == "auth.login.failure"
    assert getattr(records[0], "reason") == "invalid_credentials"
    assert getattr(records[0], "user_id") is not None


async def test_login_failure_unknown_email_omits_user_id_and_email(
    async_client: AsyncClient,
    seeded_zas_users: list[User],
    caplog: pytest.LogCaptureFixture,
) -> None:
    del seeded_zas_users
    caplog.set_level(logging.INFO, logger="app.auth.audit")
    await async_client.post(
        "/auth/login/password",
        json={"email": "ghost@zas.local", "password": "anything"},
    )

    records = _audit_records(caplog)
    assert len(records) == 1
    assert getattr(records[0], "reason") == "unknown_email"
    assert getattr(records[0], "user_id", None) is None
    # The supplied email MUST NOT appear in any audit field.
    for record in records:
        for value in record.__dict__.values():
            assert "ghost@zas.local" not in str(value)


async def test_password_and_cookie_never_logged(
    async_client: AsyncClient,
    seeded_zas_users: list[User],
    caplog: pytest.LogCaptureFixture,
) -> None:
    del seeded_zas_users
    caplog.set_level(logging.INFO, logger="app.auth.audit")
    secret = _DEFAULT_PASSWORD
    response = await async_client.post(
        "/auth/login/password",
        json={"email": CAREGIVER_EMAIL, "password": secret},
    )
    cookie_value = response.cookies.get("BACKEND_SESSION") or ""

    for record in _audit_records(caplog):
        for value in record.__dict__.values():
            text = str(value)
            assert secret not in text
            if cookie_value:
                assert cookie_value not in text


async def test_logout_emits_audit(
    async_client: AsyncClient,
    seeded_zas_users: list[User],
    caplog: pytest.LogCaptureFixture,
) -> None:
    del seeded_zas_users
    await async_client.post(
        "/auth/login/password",
        json={"email": CAREGIVER_EMAIL, "password": _DEFAULT_PASSWORD},
    )
    caplog.clear()
    caplog.set_level(logging.INFO, logger="app.auth.audit")

    await async_client.post("/auth/logout")

    records = _audit_records(caplog)
    assert len(records) == 1
    assert records[0].getMessage() == "auth.logout"
    assert getattr(records[0], "user_id") is not None


async def test_logout_without_cookie_emits_no_audit(
    async_client: AsyncClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="app.auth.audit")
    await async_client.post("/auth/logout")
    assert _audit_records(caplog) == []
