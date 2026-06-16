from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Depends
from pydantic import AnyHttpUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["dev", "test", "production"]
AdapterMode = Literal["stub", "live"]

DEFAULT_SESSION_SECRET = "change-me-in-production"
DEFAULT_DEV_ORIGINS: list[AnyHttpUrl] = [
    AnyHttpUrl("http://localhost:5173"),
    AnyHttpUrl("http://localhost:8081"),
]
DEFAULT_DATABASE_URL = "postgresql+asyncpg://zas:zas@localhost:5434/zas"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BACKEND_",
        env_file=".env",
        extra="ignore",
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
    # Luscii is token-presence-driven, not mode-driven: token set ⇒ live
    # client, unset ⇒ unconfigured (endpoints answer 503 luscii_not_configured).
    luscii_api_url: AnyHttpUrl = AnyHttpUrl("https://vitalsapi.luscii.com")
    luscii_api_token: SecretStr | None = None
    # DEV-ONLY: serve a canned `LusciiFixtureClient` when no real token is
    # configured. Lets `moon run :up` reach the chart UI without a token.
    # MUST stay off in production — fixture data is synthetic.
    luscii_fixtures: bool = False

    @field_validator("luscii_api_token", mode="before")
    @classmethod
    def _empty_token_is_unconfigured(cls, v: object) -> object:
        # Compose passes BACKEND_LUSCII_API_TOKEN through with an empty
        # default; empty/whitespace must mean "unconfigured", never a client
        # with a blank bearer token.
        if isinstance(v, str) and not v.strip():
            return None
        return v

    database_url: str = DEFAULT_DATABASE_URL

    # Ory access plane. Localhost defaults serve host-run dev + tests;
    # compose overrides with in-network hosts (kratos / keto).
    kratos_public_url: AnyHttpUrl = AnyHttpUrl("http://localhost:4433")
    kratos_admin_url: AnyHttpUrl = AnyHttpUrl("http://localhost:4434")
    keto_read_url: AnyHttpUrl = AnyHttpUrl("http://localhost:4466")
    keto_write_url: AnyHttpUrl = AnyHttpUrl("http://localhost:4467")
    # Relation checks stay dark until the tuple pipeline is populated;
    # off ⇒ pre-Ory role+tenant guards only.
    authz_keto_enabled: bool = False
    # Break-glass (REQ-NON-8): hard cap on requested grant duration.
    authz_break_glass_max_hours: int = 4
    realtime_keepalive_seconds: int = 15
    realtime_idle_timeout_seconds: int = 30 * 60

    # Temporal (pathway runtime). Localhost default targets the isolated
    # dev server (docker-compose.temporal.yml); deploy overrides the host.
    temporal_address: str = "localhost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "pathway-runtime"


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]
