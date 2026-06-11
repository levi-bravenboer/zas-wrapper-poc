"""Versioned JSON snapshots of the Luscii localisation catalogues.

The live sync (`backend:luscii-sync`) takes ~30-45 minutes because the
public API serves the catalogues only as unfiltered cursor lists. Snapshots
make that a one-time cost: `backend:luscii-export` dumps the synced tables
into per-locale JSON files committed under `apps/backend/data/luscii_catalogue/`,
and `backend:luscii-import` full-replaces the tables from those files in
seconds — no token, no upstream calls.

File format: one `<locale>.json` per locale, rows sorted by natural key and
serialized one per line so git diffs stay row-granular. The locale lives at
file level only; rows omit it (and omit null fields, for size — the response
catalogue alone is 100k+ rows).

Filenames must survive case-insensitive checkouts (macOS/Windows): the
upstream catalogue contains locales differing only by case (observed
2026-06-11: `en-US` and `en-us`), so case-colliding locales get a
deterministic `~N` suffix by sort order. The payload `locale` field is
authoritative either way.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Sequence
from pathlib import Path

from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.services.luscii.catalogue_store import replace_catalogue

logger = logging.getLogger(__name__)

# apps/backend/data/luscii_catalogue — committed to version control.
DEFAULT_SNAPSHOT_DIR = Path(__file__).resolve().parents[3] / "data" / "luscii_catalogue"

# Locales become filenames; reject anything that wouldn't round-trip safely.
_LOCALE_RE = re.compile(r"^[A-Za-z0-9_-]+$")


class SnapshotError(RuntimeError):
    """Snapshot directory or file contents are unusable."""


class _SnapshotModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class SnapshotInstrumentLocalisation(_SnapshotModel):
    instrument_id: str
    instrument_version: str
    name: str | None = None
    unit: str | None = None


class SnapshotInstrumentItemLocalisation(_SnapshotModel):
    item_id: str
    item_version: str
    title: str | None = None
    subtitle: str | None = None
    unit: str | None = None


class SnapshotItemResponseLocalisation(_SnapshotModel):
    item_response_id: str
    response_text: str | None = None


class SnapshotFile(_SnapshotModel):
    locale: str
    instrument_localisations: list[SnapshotInstrumentLocalisation]
    instrument_item_localisations: list[SnapshotInstrumentItemLocalisation]
    item_response_localisations: list[SnapshotItemResponseLocalisation]


def _snapshot_filenames(locales: list[str]) -> dict[str, str]:
    """Deterministic filename per locale, safe on case-insensitive filesystems.

    Locales that collide case-insensitively would silently overwrite each
    other's files on macOS/Windows; the second and later ones (sort order)
    get a `~N` suffix instead.
    """
    names: dict[str, str] = {}
    fold_counts: dict[str, int] = {}
    for locale in sorted(locales):
        n = fold_counts.get(locale.casefold(), 0) + 1
        fold_counts[locale.casefold()] = n
        names[locale] = f"{locale}.json" if n == 1 else f"{locale}~{n}.json"
    return names


def _stem_matches_locale(stem: str, locale: str) -> bool:
    if stem == locale:
        return True
    prefix = f"{locale}~"
    return stem.startswith(prefix) and stem[len(prefix) :].isdigit()


async def export_catalogue_snapshots(
    session: AsyncSession, directory: Path = DEFAULT_SNAPSHOT_DIR
) -> dict[str, dict[str, int]]:
    """Dump the catalogue tables into per-locale JSON files.

    Mirrors full-replace semantics on disk: writes one file per locale present
    in the tables and removes stale `<locale>.json` files for locales that no
    longer exist. Returns per-locale row counts.
    """
    instrument_rows = (await session.scalars(select(LusciiInstrumentLocalisationRow))).all()
    item_rows = (await session.scalars(select(LusciiInstrumentItemLocalisationRow))).all()
    response_rows = (await session.scalars(select(LusciiItemResponseLocalisationRow))).all()
    if not (instrument_rows or item_rows or response_rows):
        raise SnapshotError(
            "Luscii catalogue tables are empty — run `moon run backend:luscii-sync` first."
        )

    locales = sorted(
        {r.locale for r in instrument_rows}
        | {r.locale for r in item_rows}
        | {r.locale for r in response_rows}
    )
    for locale in locales:
        if not _LOCALE_RE.match(locale):
            raise SnapshotError(f"locale {locale!r} is not filename-safe; refusing to export")

    directory.mkdir(parents=True, exist_ok=True)
    filenames = _snapshot_filenames(locales)
    counts: dict[str, dict[str, int]] = {}
    for locale in locales:
        payload = SnapshotFile(
            locale=locale,
            instrument_localisations=sorted(
                (
                    SnapshotInstrumentLocalisation(
                        instrument_id=r.instrument_id,
                        instrument_version=r.instrument_version,
                        name=r.name,
                        unit=r.unit,
                    )
                    for r in instrument_rows
                    if r.locale == locale
                ),
                key=lambda s: (s.instrument_id, s.instrument_version),
            ),
            instrument_item_localisations=sorted(
                (
                    SnapshotInstrumentItemLocalisation(
                        item_id=r.item_id,
                        item_version=r.item_version,
                        title=r.title,
                        subtitle=r.subtitle,
                        unit=r.unit,
                    )
                    for r in item_rows
                    if r.locale == locale
                ),
                key=lambda s: (s.item_id, s.item_version),
            ),
            item_response_localisations=sorted(
                (
                    SnapshotItemResponseLocalisation(
                        item_response_id=r.item_response_id,
                        response_text=r.response_text,
                    )
                    for r in response_rows
                    if r.locale == locale
                ),
                key=lambda s: s.item_response_id,
            ),
        )
        target = directory / filenames[locale]
        if target.exists():
            # Case-insensitive filesystems resolve e.g. en-us.json to an
            # existing en-US.json and keep the old name — recreate instead.
            target.unlink()
        target.write_text(_render(payload), encoding="utf-8")
        counts[locale] = {
            "instrument_localisations": len(payload.instrument_localisations),
            "instrument_item_localisations": len(payload.instrument_item_localisations),
            "item_response_localisations": len(payload.item_response_localisations),
        }
        logger.info("luscii snapshot exported %s: %s", filenames[locale], counts[locale])

    expected = set(filenames.values())
    for stale in sorted(directory.glob("*.json")):
        if stale.name not in expected:
            stale.unlink()
            logger.info("luscii snapshot removed stale %s", stale.name)

    return counts


async def import_catalogue_snapshots_if_empty(
    session: AsyncSession, directory: Path = DEFAULT_SNAPSHOT_DIR
) -> dict[str, int] | None:
    """Boot-time variant (seed_all): import only into empty tables.

    The seed runs on every container boot, so this must stay cheap and must
    never clobber a populated catalogue (e.g. a fresher manual sync). Missing
    or empty snapshot directory degrades to a warning — the app works either
    way, measurements just show raw values until an import runs.
    """
    for model in (
        LusciiInstrumentLocalisationRow,
        LusciiInstrumentItemLocalisationRow,
        LusciiItemResponseLocalisationRow,
    ):
        if await session.scalar(select(func.count()).select_from(model)):
            logger.info("luscii catalogue already populated — snapshot import skipped")
            return None
    try:
        return await import_catalogue_snapshots(session, directory)
    except SnapshotError as exc:
        logger.warning("luscii catalogue snapshot import skipped: %s", exc)
        return None


async def import_catalogue_snapshots(
    session: AsyncSession, directory: Path = DEFAULT_SNAPSHOT_DIR
) -> dict[str, int]:
    """Full-replace the catalogue tables from the per-locale snapshot files."""
    files = sorted(directory.glob("*.json"))
    if not files:
        raise SnapshotError(
            f"no snapshot files in {directory} — run `moon run backend:luscii-export` "
            "after a sync, or pull them from version control."
        )

    snapshots: list[SnapshotFile] = []
    seen_locales: set[str] = set()
    for path in files:
        try:
            snapshot = SnapshotFile.model_validate(json.loads(path.read_text(encoding="utf-8")))
        except (ValueError, ValidationError) as exc:
            raise SnapshotError(f"{path.name} is not a valid catalogue snapshot") from exc
        if not _stem_matches_locale(path.stem, snapshot.locale):
            raise SnapshotError(
                f"{path.name} declares locale {snapshot.locale!r}; filename and payload must agree"
            )
        if snapshot.locale in seen_locales:
            raise SnapshotError(
                f"locale {snapshot.locale!r} appears in more than one snapshot file"
            )
        seen_locales.add(snapshot.locale)
        snapshots.append(snapshot)

    counts = await replace_catalogue(
        session,
        instrument_rows=(
            LusciiInstrumentLocalisationRow(
                instrument_id=s.instrument_id,
                instrument_version=s.instrument_version,
                locale=snapshot.locale,
                name=s.name,
                unit=s.unit,
            )
            for snapshot in snapshots
            for s in snapshot.instrument_localisations
        ),
        item_rows=(
            LusciiInstrumentItemLocalisationRow(
                item_id=s.item_id,
                item_version=s.item_version,
                locale=snapshot.locale,
                title=s.title,
                subtitle=s.subtitle,
                unit=s.unit,
            )
            for snapshot in snapshots
            for s in snapshot.instrument_item_localisations
        ),
        response_rows=(
            LusciiItemResponseLocalisationRow(
                item_response_id=s.item_response_id,
                locale=snapshot.locale,
                response_text=s.response_text,
            )
            for snapshot in snapshots
            for s in snapshot.item_response_localisations
        ),
    )
    logger.info("luscii catalogue imported from %d snapshot file(s): %s", len(files), counts)
    return counts


def _render(payload: SnapshotFile) -> str:
    """Serialize with one row per line so git diffs stay row-granular."""

    def rows(items: Sequence[_SnapshotModel]) -> str:
        if not items:
            return "[]"
        lines = ",\n".join(
            "    "
            + json.dumps(item.model_dump(exclude_none=True), ensure_ascii=False, sort_keys=True)
            for item in items
        )
        return "[\n" + lines + "\n  ]"

    return (
        "{\n"
        f'  "locale": {json.dumps(payload.locale)},\n'
        f'  "instrument_localisations": {rows(payload.instrument_localisations)},\n'
        f'  "instrument_item_localisations": {rows(payload.instrument_item_localisations)},\n'
        f'  "item_response_localisations": {rows(payload.item_response_localisations)}\n'
        "}\n"
    )
