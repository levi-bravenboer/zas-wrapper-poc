"""Catalogue snapshot tests — per-locale JSON export/import round trip."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.services.luscii.catalogue_snapshot import (
    SnapshotError,
    export_catalogue_snapshots,
    import_catalogue_snapshots,
)


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


async def _seed_catalogue(session: AsyncSession) -> None:
    session.add_all(
        [
            LusciiInstrumentLocalisationRow(
                instrument_id="i-1", instrument_version="iv-1", locale="nl", name="Gewicht meting"
            ),
            LusciiInstrumentLocalisationRow(
                instrument_id="i-1", instrument_version="iv-1", locale="en", name="Weight check"
            ),
            LusciiInstrumentItemLocalisationRow(
                item_id="item-w", item_version="v1", locale="nl", title="Gewicht", unit="kg"
            ),
            LusciiItemResponseLocalisationRow(
                item_response_id="resp-yes", locale="nl", response_text="Ja"
            ),
        ]
    )
    await session.commit()


async def _counts(session: AsyncSession) -> tuple[int, int, int]:
    return (
        (await session.scalar(select(func.count(LusciiInstrumentLocalisationRow.id)))) or 0,
        (await session.scalar(select(func.count(LusciiInstrumentItemLocalisationRow.id)))) or 0,
        (await session.scalar(select(func.count(LusciiItemResponseLocalisationRow.id)))) or 0,
    )


async def test_export_writes_one_file_per_locale(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_catalogue(db_session)

    counts = await export_catalogue_snapshots(db_session, tmp_path)

    assert sorted(p.name for p in tmp_path.glob("*.json")) == ["en.json", "nl.json"]
    assert counts["nl"] == {
        "instrument_localisations": 1,
        "instrument_item_localisations": 1,
        "item_response_localisations": 1,
    }
    assert counts["en"] == {
        "instrument_localisations": 1,
        "instrument_item_localisations": 0,
        "item_response_localisations": 0,
    }

    nl = json.loads((tmp_path / "nl.json").read_text(encoding="utf-8"))
    assert nl["locale"] == "nl"
    # Rows omit the locale (file-level) and null fields (size).
    assert nl["instrument_item_localisations"] == [
        {"item_id": "item-w", "item_version": "v1", "title": "Gewicht", "unit": "kg"}
    ]


async def test_export_import_round_trip_replaces_tables(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    await _seed_catalogue(db_session)
    await export_catalogue_snapshots(db_session, tmp_path)

    # Mutate the tables so a no-op import would be visible.
    await db_session.execute(delete(LusciiInstrumentLocalisationRow))
    db_session.add(
        LusciiItemResponseLocalisationRow(
            item_response_id="resp-stale", locale="de", response_text="Veraltet"
        )
    )
    await db_session.commit()

    counts = await import_catalogue_snapshots(db_session, tmp_path)
    await db_session.commit()

    assert counts == {
        "instrument_localisations": 2,
        "instrument_item_localisations": 1,
        "item_response_localisations": 1,
    }
    assert await _counts(db_session) == (2, 1, 1)
    stale = await db_session.scalar(
        select(LusciiItemResponseLocalisationRow).where(
            LusciiItemResponseLocalisationRow.item_response_id == "resp-stale"
        )
    )
    assert stale is None
    restored = await db_session.scalar(
        select(LusciiInstrumentItemLocalisationRow).where(
            LusciiInstrumentItemLocalisationRow.item_id == "item-w"
        )
    )
    assert restored is not None
    assert restored.locale == "nl"
    assert restored.title == "Gewicht"
    assert restored.unit == "kg"


async def test_export_removes_stale_locale_files(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    (tmp_path / "fr.json").write_text("{}", encoding="utf-8")
    await _seed_catalogue(db_session)

    await export_catalogue_snapshots(db_session, tmp_path)

    assert not (tmp_path / "fr.json").exists()


async def test_export_errors_on_empty_tables(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    with pytest.raises(SnapshotError, match="luscii-sync"):
        await export_catalogue_snapshots(db_session, tmp_path)


async def test_import_errors_on_empty_directory(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    with pytest.raises(SnapshotError, match="no snapshot files"):
        await import_catalogue_snapshots(db_session, tmp_path)


async def test_import_rejects_locale_filename_mismatch(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    payload = {
        "locale": "nl",
        "instrument_localisations": [],
        "instrument_item_localisations": [],
        "item_response_localisations": [],
    }
    (tmp_path / "en.json").write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(SnapshotError, match="filename and payload must agree"):
        await import_catalogue_snapshots(db_session, tmp_path)


async def test_import_rejects_malformed_file(
    db_session: AsyncSession, tmp_path: Path
) -> None:
    (tmp_path / "nl.json").write_text('{"locale": "nl"}', encoding="utf-8")

    with pytest.raises(SnapshotError, match="not a valid catalogue snapshot"):
        await import_catalogue_snapshots(db_session, tmp_path)
