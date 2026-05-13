from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.adapters import build_hix_client, build_luscii_client
from app.api import register_routers
from app.core.errors import AppError, ErrorResponse
from app.core.logging import configure_logging
from app.core.readiness import ReadinessRegistry
from app.core.security import SessionSigner
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


def _error_response(status_code: int, payload: ErrorResponse) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def _http_exception_to_error_response(exc: HTTPException) -> ErrorResponse:
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        details_field: dict[str, Any] | None = detail.get("details")
        return ErrorResponse(
            code=str(detail["code"]),
            message=str(detail["message"]),
            details=details_field,
        )
    message = detail if isinstance(detail, str) else "HTTP error"
    return ErrorResponse(
        code=f"processing.http.{exc.status_code}",
        message=message,
    )


def _register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc.status_code, exc.to_response())

    @app.exception_handler(HTTPException)
    async def _handle_http_exception(_request: Request, exc: HTTPException) -> JSONResponse:
        return _error_response(exc.status_code, _http_exception_to_error_response(exc))

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        payload = ErrorResponse(
            code="invalid.validation.body",
            message="Request body failed validation",
            details={"errors": exc.errors()},
        )
        return _error_response(422, payload)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    _check_production_safety(settings)
    configure_logging(settings)

    fastapi_kwargs: dict[str, Any] = {
        "title": "ZAS Wrapper Backend",
        "version": __version__,
        "description": "FHIR gateway and orchestrator backend for the ZAS Telegeneeskunde POC.",
    }
    if settings.public_url is not None:
        fastapi_kwargs["servers"] = [{"url": str(settings.public_url).rstrip("/")}]
    app = FastAPI(**fastapi_kwargs)
    app.state.settings = settings
    app.state.started_at = datetime.now(timezone.utc)
    app.state.readiness = ReadinessRegistry()

    hix_client = build_hix_client(settings)
    luscii_client = build_luscii_client(settings)
    app.state.hix_client = hix_client
    app.state.luscii_client = luscii_client
    app.state.readiness.register("hix", hix_client.ping)
    app.state.readiness.register("luscii", luscii_client.ping)

    app.state.session_signer = SessionSigner(settings.session_secret_key.get_secret_value())

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(o).rstrip("/") for o in settings.cors_origins],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Type"],
    )

    _register_exception_handlers(app)
    register_routers(app)
    return app


app = create_app()
