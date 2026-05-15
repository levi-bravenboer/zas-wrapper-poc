from __future__ import annotations

import pytest

from app.adapters.hix import HixPatientAdapter


@pytest.mark.asyncio
async def test_fetch_raises_not_implemented() -> None:
    adapter = HixPatientAdapter()
    with pytest.raises(NotImplementedError, match="MVP scope"):
        await adapter.fetch("seed:patient:1")


@pytest.mark.asyncio
async def test_upsert_from_hix_raises_not_implemented() -> None:
    adapter = HixPatientAdapter()
    with pytest.raises(NotImplementedError, match="MVP scope"):
        await adapter.upsert_from_hix({"id": "abc"})
