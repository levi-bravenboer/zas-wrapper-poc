from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Request, Response, status

from app.schemas.health import HealthResponse, ReadinessResponse, RootResponse

router = APIRouter(tags=["health"])


@router.get("/", operation_id="get_root_metadata", response_model=RootResponse)
def root(request: Request) -> RootResponse:
    app = request.app
    return RootResponse(name=app.title, version=app.version)


@router.get("/healthz", operation_id="get_health", response_model=HealthResponse)
def health(request: Request) -> HealthResponse:
    started_at: datetime = request.app.state.started_at
    return HealthResponse(version=request.app.version, started_at=started_at)


@router.get(
    "/ready",
    operation_id="get_readiness",
    response_model=ReadinessResponse,
    responses={503: {"model": ReadinessResponse}},
)
async def ready(request: Request, response: Response) -> ReadinessResponse:
    registry = request.app.state.readiness
    checks = await registry.check_all()
    is_ready = registry.is_ready(checks)
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(status="ready" if is_ready else "not_ready", checks=checks)


__all__ = ["router"]
