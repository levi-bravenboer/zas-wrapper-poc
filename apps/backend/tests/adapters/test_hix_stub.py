from __future__ import annotations

import pytest

from app.adapters.hix import HixStubClient
from app.core.errors import AppError


@pytest.mark.asyncio
async def test_ping_is_noop() -> None:
    client = HixStubClient()
    assert await client.ping() is None


@pytest.mark.asyncio
async def test_get_patient_returns_fixture() -> None:
    client = HixStubClient()
    patient = await client.get_patient("demo-1")
    assert patient.id == "demo-1"
    assert patient.name == "Demo Patient One"


@pytest.mark.asyncio
async def test_get_patient_unknown_raises_apperror() -> None:
    client = HixStubClient()
    with pytest.raises(AppError) as info:
        await client.get_patient("does-not-exist")
    assert info.value.code == "not-found.hix.patient"
    assert info.value.status_code == 404
