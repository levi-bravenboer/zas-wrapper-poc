from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from app.schemas.health import CheckStatus

PingCallable = Callable[[], Awaitable[None]]

logger = logging.getLogger(__name__)


class ReadinessRegistry:
    """Holds named async ping callables for `/ready` to aggregate.

    Each registered ping is expected to raise on failure. The registry catches
    the exception, logs it at WARNING, and reports `fail` for that check; all
    other checks continue to run.
    """

    def __init__(self) -> None:
        self._pings: dict[str, PingCallable] = {}

    def register(self, name: str, ping: PingCallable) -> None:
        self._pings[name] = ping

    def names(self) -> list[str]:
        return list(self._pings)

    async def check_all(self) -> dict[str, CheckStatus]:
        results: dict[str, CheckStatus] = {}
        for name, ping in self._pings.items():
            try:
                await ping()
                results[name] = "ok"
            except Exception:
                logger.warning("readiness.ping.fail", extra={"check": name}, exc_info=True)
                results[name] = "fail"
        return results

    def is_ready(self, checks: dict[str, CheckStatus]) -> bool:
        return all(status == "ok" for status in checks.values())
