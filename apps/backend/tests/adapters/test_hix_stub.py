from __future__ import annotations

import pytest

from app.adapters.hix import HixStubClient


@pytest.mark.asyncio
async def test_ping_is_noop() -> None:
    client = HixStubClient()
    assert await client.ping() is None
