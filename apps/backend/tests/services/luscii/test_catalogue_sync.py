"""Catalogue sync tests — full-replace semantics against the test DB."""

from __future__ import annotations

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.luscii import (
    LusciiInstrumentItemLocalisation,
    LusciiInstrumentLocalisation,
    LusciiItemResponseLocalisation,
)
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.services.luscii.catalogue_sync import sync_luscii_catalogue
from tests.fakes.luscii import FakeLusciiClient


@pytest.fixture(autouse=True)
async def _clean_luscii_catalogue(db_session: AsyncSession) -> None:
    # Catalogue tables are not tenant-scoped, so `clean_tenants` never wipes
    # them — clear explicitly so natural-key inserts can't collide across tests.
    for model in (
        LusciiInstrumentLocalisationRow,
        LusciiInstrumentItemLocalisationRow,
        LusciiItemResponseLocalisationRow,
    ):
        await db_session.execute(delete(model))
    await db_session.commit()


def _fake_with_catalogue() -> FakeLusciiClient:
    fake = FakeLusciiClient()
    fake.instrument_localisations = [
        LusciiInstrumentLocalisation(
            instrument_id="i-1", instrument_version="iv-1", locale="nl", name="Gewicht meting"
        ),
        LusciiInstrumentLocalisation(
            instrument_id="i-1", instrument_version="iv-1", locale="en", name="Weight check"
        ),
    ]
    fake.instrument_item_localisations = [
        LusciiInstrumentItemLocalisation(
            item_id="item-w", item_version="v1", locale="nl", title="Gewicht", unit="kg"
        ),
    ]
    fake.item_response_localisations = [
        LusciiItemResponseLocalisation(
            item_response_id="resp-yes", locale="nl", response_text="Ja"
        ),
    ]
    return fake


async def _counts(session: AsyncSession) -> tuple[int, int, int]:
    return (
        (await session.scalar(select(func.count(LusciiInstrumentLocalisationRow.id)))) or 0,
        (await session.scalar(select(func.count(LusciiInstrumentItemLocalisationRow.id)))) or 0,
        (await session.scalar(select(func.count(LusciiItemResponseLocalisationRow.id)))) or 0,
    )


async def test_sync_populates_tables_and_reports_counts(db_session: AsyncSession) -> None:
    fake = _fake_with_catalogue()
    counts = await sync_luscii_catalogue(db_session, fake)
    await db_session.commit()

    assert counts == {
        "instrument_localisations": 2,
        "instrument_item_localisations": 1,
        "item_response_localisations": 1,
    }
    assert await _counts(db_session) == (2, 1, 1)

    row = await db_session.scalar(
        select(LusciiInstrumentItemLocalisationRow).where(
            LusciiInstrumentItemLocalisationRow.item_id == "item-w"
        )
    )
    assert row is not None
    assert row.title == "Gewicht"
    assert row.unit == "kg"


async def test_sync_is_full_replace_not_append(db_session: AsyncSession) -> None:
    fake = _fake_with_catalogue()
    await sync_luscii_catalogue(db_session, fake)
    await db_session.commit()

    # Second run with a changed catalogue: old rows must be gone, not duplicated.
    fake.instrument_localisations = [
        LusciiInstrumentLocalisation(
            instrument_id="i-2", instrument_version="iv-9", locale="nl", name="Bloeddruk"
        ),
    ]
    fake.instrument_item_localisations = []
    fake.item_response_localisations = []
    await sync_luscii_catalogue(db_session, fake)
    await db_session.commit()

    assert await _counts(db_session) == (1, 0, 0)
    only = await db_session.scalar(select(LusciiInstrumentLocalisationRow))
    assert only is not None
    assert only.instrument_id == "i-2"
    assert only.name == "Bloeddruk"


async def test_sync_dedupes_upstream_duplicate_natural_keys(db_session: AsyncSession) -> None:
    # Observed live 2026-06-10: the upstream catalogue repeats identical
    # (itemResponseId, locale) rows — the sync must not trip our unique index.
    fake = _fake_with_catalogue()
    fake.item_response_localisations = [
        LusciiItemResponseLocalisation(
            item_response_id="resp-dup", locale="de", response_text="Ja, wöchentlich"
        ),
        LusciiItemResponseLocalisation(
            item_response_id="resp-dup", locale="de", response_text="Ja, wöchentlich"
        ),
        LusciiItemResponseLocalisation(
            item_response_id="resp-dup", locale="nl", response_text="Ja, wekelijks"
        ),
    ]
    fake.instrument_localisations = fake.instrument_localisations + [
        fake.instrument_localisations[0]
    ]

    counts = await sync_luscii_catalogue(db_session, fake)
    await db_session.commit()

    assert counts["item_response_localisations"] == 2  # de + nl, dupe dropped
    assert counts["instrument_localisations"] == 2  # nl + en, dupe dropped
    rows = (
        await db_session.scalars(
            select(LusciiItemResponseLocalisationRow).where(
                LusciiItemResponseLocalisationRow.item_response_id == "resp-dup"
            )
        )
    ).all()
    assert sorted(r.locale for r in rows) == ["de", "nl"]
