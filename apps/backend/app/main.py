from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import register_routers
from app.core.settings import DEFAULT_SESSION_SECRET, Settings, get_settings


class InsecureProductionConfigError(RuntimeError):
    """Raised at boot when production env has insecure defaults."""


def _check_production_safety(settings: Settings) -> None:
    if settings.env != "production":
        return
    problems: list[str] = []
    if not settings.cors_origins:
        problems.append("BACKEND_CORS_ORIGINS is empty")
    if settings.session_secret_key.get_secret_value() == DEFAULT_SESSION_SECRET:
        problems.append("BACKEND_SESSION_SECRET_KEY is the default placeholder")
    if problems:
        raise InsecureProductionConfigError(
            "Refusing to boot in production with insecure defaults: " + ", ".join(problems)
        )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    _check_production_safety(settings)

    app = FastAPI(
        title="ZAS Wrapper Backend",
        version=__version__,
        description="FHIR gateway and orchestrator backend for the ZAS Telegeneeskunde POC.",
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(o).rstrip("/") for o in settings.cors_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Type"],
    )

    register_routers(app)
    return app


app = create_app()
