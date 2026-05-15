"""Server-Sent Events stream for realtime invalidation hints.

Each authenticated client gets a tenant-scoped subscription on the
process-global `RealtimePubSub`. The router publishes only the *hint*
shape `{resource, action, id, v}` — clients re-fetch via the typed REST
API. The route is excluded from the OpenAPI export to keep the
typed-client generator focused on JSON endpoints.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.core.settings import SettingsDep
from app.realtime.pubsub import get_pubsub
from app.services.auth.deps import CurrentUserDep

router = APIRouter(tags=["realtime"])


@router.get(
    "/events",
    operation_id="stream_realtime_events",
    include_in_schema=False,
)
async def stream_realtime_events(
    request: Request,
    settings: SettingsDep,
    current_user: CurrentUserDep,
) -> EventSourceResponse:
    pubsub = get_pubsub()
    tenant_id = current_user.tenant_id
    idle_timeout = float(settings.realtime_idle_timeout_seconds)

    async def _generator() -> AsyncIterator[dict[str, str]]:
        async for event in pubsub.subscribe(tenant_id, idle_timeout=idle_timeout):
            if await request.is_disconnected():
                return
            yield {"event": "message", "data": event.model_dump_json()}

    return EventSourceResponse(
        _generator(),
        ping=settings.realtime_keepalive_seconds,
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


__all__ = ["router"]
