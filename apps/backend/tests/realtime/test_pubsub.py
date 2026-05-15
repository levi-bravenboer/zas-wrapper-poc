from __future__ import annotations

import asyncio
import uuid

import pytest

from app.realtime.events import RealtimeEvent
from app.realtime.pubsub import RealtimePubSub


async def _drain(bus: RealtimePubSub, tenant_id: uuid.UUID, count: int) -> list[RealtimeEvent]:
    items: list[RealtimeEvent] = []
    async for event in bus.subscribe(tenant_id):
        items.append(event)
        if len(items) >= count:
            break
    return items


async def test_publish_fans_out_to_subscriber() -> None:
    bus = RealtimePubSub()
    tenant = uuid.uuid4()
    consumer = asyncio.create_task(_drain(bus, tenant, 1))
    await asyncio.sleep(0)  # let consumer attach
    bus.publish(tenant, RealtimeEvent(resource="demo", action="upsert", id="x"))
    received = await asyncio.wait_for(consumer, timeout=1)
    assert received[0].resource == "demo"


async def test_publish_isolated_per_tenant() -> None:
    bus = RealtimePubSub()
    a, b = uuid.uuid4(), uuid.uuid4()
    consumer_a = asyncio.create_task(_drain(bus, a, 1))
    consumer_b = asyncio.create_task(_drain(bus, b, 1))
    await asyncio.sleep(0)
    bus.publish(a, RealtimeEvent(resource="demo", action="upsert", id="a"))
    bus.publish(b, RealtimeEvent(resource="demo", action="upsert", id="b"))
    a_items = await asyncio.wait_for(consumer_a, timeout=1)
    b_items = await asyncio.wait_for(consumer_b, timeout=1)
    assert a_items[0].id == "a"
    assert b_items[0].id == "b"


async def test_drop_on_full_increments_counter() -> None:
    bus = RealtimePubSub(queue_max=1)
    tenant = uuid.uuid4()
    # Attach a subscriber whose queue fills immediately and never drains.
    queue = await bus._attach(tenant)  # type: ignore[attr-defined]
    try:
        bus.publish(tenant, RealtimeEvent(resource="demo", action="upsert"))
        bus.publish(tenant, RealtimeEvent(resource="demo", action="delete"))
        assert bus.dropped_events_total == 1
        # Queue still has one element (the first).
        assert queue.qsize() == 1
    finally:
        await bus._detach(tenant, queue)  # type: ignore[attr-defined]


async def test_publish_with_no_subscribers_is_noop() -> None:
    bus = RealtimePubSub()
    bus.publish(uuid.uuid4(), RealtimeEvent(resource="demo", action="upsert"))
    assert bus.published_events_total == 0
    assert bus.dropped_events_total == 0


async def test_active_subscribers_count() -> None:
    bus = RealtimePubSub()
    tenant = uuid.uuid4()
    assert bus.active_subscribers == 0
    queue = await bus._attach(tenant)  # type: ignore[attr-defined]
    try:
        assert bus.active_subscribers == 1
    finally:
        await bus._detach(tenant, queue)  # type: ignore[attr-defined]
    assert bus.active_subscribers == 0


@pytest.mark.parametrize("action", ["upsert", "delete"])
def test_event_validates_action(action: str) -> None:
    event = RealtimeEvent(resource="demo", action=action)  # type: ignore[arg-type]
    assert event.v == 1
