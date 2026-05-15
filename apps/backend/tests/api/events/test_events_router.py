from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.enums.user import Role
from app.db.models.user import User
from app.realtime.events import RealtimeEvent
from app.realtime.pubsub import RealtimePubSub
from scripts.seed_users import ADMIN_EMAIL

_PASSWORD = "changeme"


@pytest.fixture
async def async_client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def authed_admin(async_client: AsyncClient, seeded_zas_users: list[User]) -> User:
    admin = next(u for u in seeded_zas_users if u.role is Role.ADMIN)
    response = await async_client.post(
        "/auth/login", json={"email": ADMIN_EMAIL, "password": _PASSWORD}
    )
    assert response.status_code == 200
    return admin


def _parse_sse(body: str) -> list[dict[str, str]]:
    """Split a finished SSE body into `[{event, data}, ...]`.

    Comments (lines starting with `:`) are dropped — sse-starlette emits
    them as keep-alive pings; we keep the rest for assertion.
    """
    blocks = [b for b in body.split("\n\n") if b.strip()]
    events: list[dict[str, str]] = []
    for block in blocks:
        event_name: str | None = None
        data_lines: list[str] = []
        for line in block.split("\n"):
            if not line or line.startswith(":"):
                continue
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].lstrip())
        if event_name and data_lines:
            events.append({"event": event_name, "data": "\n".join(data_lines)})
    return events


async def _publish_when_subscribed(
    bus: RealtimePubSub, tenant_id: uuid.UUID, event: RealtimeEvent
) -> None:
    """Wait for a queue to attach, then publish. Avoids races with the
    request handler entering `pubsub.subscribe(...)`.
    """
    deadline = asyncio.get_running_loop().time() + 3.0
    while asyncio.get_running_loop().time() < deadline:
        if bus._subscribers.get(tenant_id):  # type: ignore[attr-defined]
            bus.publish(tenant_id, event)
            return
        await asyncio.sleep(0.02)
    raise AssertionError("subscriber never attached")


async def test_events_requires_session(async_client: AsyncClient) -> None:
    response = await async_client.get("/events")
    assert response.status_code == 401
    assert response.json()["code"] == "security.auth.unauthenticated"


async def test_events_streams_published_payload(
    async_client: AsyncClient,
    realtime_bus: RealtimePubSub,
    authed_admin: User,
) -> None:
    event = RealtimeEvent(resource="demo", action="upsert", id="abc")
    publish_task = asyncio.create_task(
        _publish_when_subscribed(realtime_bus, authed_admin.tenant_id, event)
    )
    try:
        response = await asyncio.wait_for(async_client.get("/events"), timeout=5)
    finally:
        await publish_task
    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert len(events) == 1
    assert events[0]["event"] == "message"
    payload = json.loads(events[0]["data"])
    assert payload == {"resource": "demo", "action": "upsert", "id": "abc", "v": 1}


async def test_events_isolates_tenants(
    async_client: AsyncClient,
    realtime_bus: RealtimePubSub,
    authed_admin: User,
) -> None:
    """Publish to a different tenant; admin's stream must not receive it."""
    other_tenant = uuid.uuid4()
    assert other_tenant != authed_admin.tenant_id
    realtime_bus.publish(other_tenant, RealtimeEvent(resource="demo", action="upsert"))
    response = await asyncio.wait_for(async_client.get("/events"), timeout=5)
    assert response.status_code == 200
    assert _parse_sse(response.text) == []


async def test_events_sets_streaming_headers(async_client: AsyncClient, authed_admin: User) -> None:
    del authed_admin
    response = await asyncio.wait_for(async_client.get("/events"), timeout=5)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"
    assert response.headers["content-type"].startswith("text/event-stream")
