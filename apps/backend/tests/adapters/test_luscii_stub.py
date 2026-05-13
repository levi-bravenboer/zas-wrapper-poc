from __future__ import annotations

import pytest

from app.adapters.luscii import LusciiStubClient


@pytest.mark.asyncio
async def test_ping_is_noop() -> None:
    client = LusciiStubClient()
    assert await client.ping() is None
