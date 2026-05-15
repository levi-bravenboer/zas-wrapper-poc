from __future__ import annotations

from collections.abc import Iterator

import pytest
from pydantic import SecretStr

from app.core.settings import Settings
from app.realtime.pubsub import RealtimePubSub, set_pubsub_for_tests
from tests._settings import build_settings


@pytest.fixture(autouse=True)
def _autoclean_tenants(clean_tenants: None) -> None:
    """Wipe `users` + `tenants` around every events router test."""


@pytest.fixture
def settings() -> Settings:
    # Tight idle timeout so SSE streams close themselves within the test
    # window — lets us await the full response body instead of fighting
    # ASGI streaming iteration.
    return build_settings(
        session_secret_key=SecretStr("test-secret"),
        database_url="postgresql+asyncpg://zas:zas@localhost:5433/zas_test",
        realtime_keepalive_seconds=60,
        realtime_idle_timeout_seconds=1,
    )


@pytest.fixture
def realtime_bus() -> Iterator[RealtimePubSub]:
    bus = RealtimePubSub()
    previous = set_pubsub_for_tests(bus)
    try:
        yield bus
    finally:
        if previous is not None:
            set_pubsub_for_tests(previous)
