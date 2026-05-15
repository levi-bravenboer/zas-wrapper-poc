from __future__ import annotations

from pydantic import SecretStr

from tests._settings import build_settings


def test_production_uses_host_prefix() -> None:
    settings = build_settings(env="production", session_secret_key=SecretStr("x"))
    assert settings.session_cookie_name == "__Host-BACKEND_SESSION"


def test_non_production_uses_unprefixed_name() -> None:
    dev = build_settings(env="dev", session_secret_key=SecretStr("x"))
    test = build_settings(env="test", session_secret_key=SecretStr("x"))
    assert dev.session_cookie_name == "BACKEND_SESSION"
    assert test.session_cookie_name == "BACKEND_SESSION"
