from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Depends
from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["dev", "test", "production"]
AdapterMode = Literal["stub", "live"]

DEFAULT_SESSION_SECRET = "change-me-in-production"
DEFAULT_DEV_ORIGINS: list[AnyHttpUrl] = [AnyHttpUrl("http://localhost:5173")]
DEFAULT_DATABASE_URL = "postgresql+asyncpg://zas:zas@localhost:5434/zas"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BACKEND_",
        env_file=".env",
        extra="forbid",
        case_sensitive=False,
    )

    env: Environment = "dev"
    cors_origins: list[AnyHttpUrl] = Field(default_factory=lambda: list(DEFAULT_DEV_ORIGINS))
    session_secret_key: SecretStr = SecretStr(DEFAULT_SESSION_SECRET)
    session_max_age_seconds: int = 8 * 60 * 60

    @property
    def session_cookie_name(self) -> str:
        # `__Host-` prefix binds the cookie to Secure + Path=/ + no Domain attribute
        # (browser enforced) — hardens against subdomain cookie injection in prod.
        return "__Host-BACKEND_SESSION" if self.env == "production" else "BACKEND_SESSION"

    public_url: AnyHttpUrl | None = None
    hix_mode: AdapterMode = "stub"
    luscii_mode: AdapterMode = "stub"
    database_url: str = DEFAULT_DATABASE_URL
    realtime_keepalive_seconds: int = 15
    realtime_idle_timeout_seconds: int = 30 * 60


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]
