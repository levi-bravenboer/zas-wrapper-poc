"""In-process tenant-scoped pub/sub for realtime invalidation events.

Single-pod PoC: producers (`flush_hook`) call `publish(tenant_id, event)`;
the `/events` SSE router calls `subscribe(tenant_id)` and drains the
returned `AsyncIterator`. A multi-pod broadcaster (Redis or
Postgres `LISTEN/NOTIFY` fan-out) is tracked as backlog `BL-NNN`.

Each subscriber gets its own bounded `asyncio.Queue`. When a subscriber
falls behind, we drop the event for that subscriber only and increment
`dropped_events_total` — we never block other subscribers and we never
block the producer.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from collections.abc import AsyncIterator
from uuid import UUID

from app.realtime.events import RealtimeEvent

logger = logging.getLogger(__name__)

DEFAULT_QUEUE_MAX = 256


class RealtimePubSub:
    """Tenant-scoped fan-out. Single instance per process."""

    def __init__(self, *, queue_max: int = DEFAULT_QUEUE_MAX) -> None:
        self._queue_max = queue_max
        self._subscribers: dict[UUID, set[asyncio.Queue[RealtimeEvent]]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self.published_events_total = 0
        self.dropped_events_total = 0

    @property
    def active_subscribers(self) -> int:
        return sum(len(q) for q in self._subscribers.values())

    async def _attach(self, tenant_id: UUID) -> asyncio.Queue[RealtimeEvent]:
        queue: asyncio.Queue[RealtimeEvent] = asyncio.Queue(maxsize=self._queue_max)
        async with self._lock:
            self._subscribers[tenant_id].add(queue)
        return queue

    async def _detach(self, tenant_id: UUID, queue: asyncio.Queue[RealtimeEvent]) -> None:
        async with self._lock:
            self._subscribers[tenant_id].discard(queue)
            if not self._subscribers[tenant_id]:
                self._subscribers.pop(tenant_id, None)

    def publish(self, tenant_id: UUID, event: RealtimeEvent) -> None:
        """Fan event out to every subscriber for `tenant_id`. Non-blocking."""
        queues = self._subscribers.get(tenant_id)
        if not queues:
            return
        self.published_events_total += 1
        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                self.dropped_events_total += 1
                logger.warning("realtime: dropping event for tenant %s (queue full)", tenant_id)

    async def subscribe(
        self, tenant_id: UUID, *, idle_timeout: float | None = None
    ) -> AsyncIterator[RealtimeEvent]:
        """Yield events for `tenant_id` until the caller breaks out.

        The caller (`/events` router) owns the lifecycle; we attach a
        bounded queue on entry and detach + drain on exit. When
        `idle_timeout` is set, the iterator stops after that many seconds
        of no events (`asyncio.TimeoutError` is swallowed into a graceful
        close).
        """
        queue = await self._attach(tenant_id)
        try:
            while True:
                if idle_timeout is None:
                    event = await queue.get()
                else:
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=idle_timeout)
                    except TimeoutError:
                        return
                yield event
        finally:
            await self._detach(tenant_id, queue)


_GLOBAL: RealtimePubSub | None = None


def get_pubsub() -> RealtimePubSub:
    """Return the process-global pub/sub singleton (lazy-init)."""
    global _GLOBAL
    if _GLOBAL is None:
        _GLOBAL = RealtimePubSub()
    return _GLOBAL


def reset_pubsub_for_tests() -> None:
    """Test helper: drop the global singleton so the next call yields a fresh one."""
    global _GLOBAL
    _GLOBAL = None


def set_pubsub_for_tests(bus: RealtimePubSub) -> RealtimePubSub | None:
    """Test helper: install `bus` as the global singleton, returning the previous one."""
    global _GLOBAL
    previous = _GLOBAL
    _GLOBAL = bus
    return previous
