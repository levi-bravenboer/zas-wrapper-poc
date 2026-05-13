import pytest
from pydantic import SecretStr

from app.core.settings import DEFAULT_SESSION_SECRET
from app.main import InsecureProductionConfigError, _check_production_safety
from tests._settings import build_settings


def test_settings_load_defaults() -> None:
    settings = build_settings()
    assert settings.env == "dev"
    assert settings.session_cookie_name == "BACKEND_SESSION"
    assert settings.hix_mode == "stub"
    assert settings.luscii_mode == "stub"
    assert [str(o) for o in settings.cors_origins] == ["http://localhost:5173/"]


def test_settings_loads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BACKEND_ENV", "production")
    monkeypatch.setenv("BACKEND_CORS_ORIGINS", '["https://app.example.com"]')
    monkeypatch.setenv("BACKEND_SESSION_SECRET_KEY", "super-secret-value")
    monkeypatch.setenv("BACKEND_HIX_MODE", "stub")

    settings = build_settings()

    assert settings.env == "production"
    assert [str(o) for o in settings.cors_origins] == ["https://app.example.com/"]
    assert settings.session_secret_key.get_secret_value() == "super-secret-value"


def test_production_guard_rejects_default_secret() -> None:
    settings = build_settings(
        env="production",
        cors_origins=["https://app.example.com"],
        session_secret_key=SecretStr(DEFAULT_SESSION_SECRET),
    )
    with pytest.raises(InsecureProductionConfigError):
        _check_production_safety(settings)


def test_production_guard_rejects_empty_origins() -> None:
    settings = build_settings(
        env="production",
        cors_origins=[],
        session_secret_key=SecretStr("ok-secret"),
    )
    with pytest.raises(InsecureProductionConfigError):
        _check_production_safety(settings)


def test_production_guard_passes_when_safe() -> None:
    settings = build_settings(
        env="production",
        cors_origins=["https://app.example.com"],
        session_secret_key=SecretStr("ok-secret"),
    )
    _check_production_safety(settings)
