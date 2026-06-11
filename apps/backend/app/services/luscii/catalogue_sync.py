"""Full-replace sync of the Luscii localisation catalogues into local tables.

Why this exists: the public API only serves these catalogues as unfiltered
org-wide cursor lists (measured 2026-06-10: 15.6k instrument-localisations,
40k+ item- and response-localisations, perPage capped at 100, all filter
params ignored). Resolving measurement labels per request is therefore
impossible; the decoder reads these tables instead. Run via
`scripts/sync_luscii_catalogue.py` (moon task `backend:luscii-sync`).

Full replace: catalogues are vendor reference data without stable row ids in
our model — delete-all + bulk insert inside one transaction keeps the sync
idempotent and the table consistent for concurrent readers.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Hashable, Iterable
from typing import TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.luscii import LusciiClient
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.services.luscii.catalogue_store import replace_catalogue

logger = logging.getLogger(__name__)

_R = TypeVar("_R")


def _dedupe(rows: Iterable[_R], key: Callable[[_R], Hashable]) -> tuple[list[_R], int]:
    """First occurrence per key wins. Returns (unique rows, dropped count)."""
    seen: dict[Hashable, _R] = {}
    total = 0
    for row in rows:
        total += 1
        seen.setdefault(key(row), row)
    return list(seen.values()), total - len(seen)


async def sync_luscii_catalogue(session: AsyncSession, client: LusciiClient) -> dict[str, int]:
    """Fetch all three catalogues and replace the local tables. Returns row counts."""

    # Previous sync's row counts serve as progress estimates — the API
    # itself exposes no totals. None on the first sync.
    async def _count(model: type) -> int | None:
        n = await session.scalar(select(func.count()).select_from(model))
        return n or None

    prev_instr = await _count(LusciiInstrumentLocalisationRow)
    prev_items = await _count(LusciiInstrumentItemLocalisationRow)
    prev_resps = await _count(LusciiItemResponseLocalisationRow)

    # Three independent cursor chains — pages within one catalogue are
    # inherently sequential (cursor pagination), but the catalogues
    # themselves fetch concurrently: wall time ≈ the longest chain.
    instrument_locs, item_locs, response_locs = await asyncio.gather(
        client.get_instrument_localisations(expected_total=prev_instr),
        client.get_instrument_item_localisations(expected_total=prev_items),
        client.get_item_response_localisations(expected_total=prev_resps),
    )

    # The upstream catalogues contain duplicate natural-key rows (observed
    # 2026-06-10: identical (itemResponseId, locale) rows repeated with the
    # same text). First occurrence wins; our unique constraints stay as
    # local hygiene.
    instrument_locs, instr_dupes = _dedupe(
        instrument_locs, lambda r: (r.instrument_id, r.instrument_version, r.locale)
    )
    item_locs, item_dupes = _dedupe(
        item_locs, lambda r: (r.item_id, r.item_version, r.locale)
    )
    response_locs, response_dupes = _dedupe(
        response_locs, lambda r: (r.item_response_id, r.locale)
    )
    if instr_dupes or item_dupes or response_dupes:
        logger.info(
            "luscii catalogue upstream duplicates dropped: instruments=%d items=%d responses=%d",
            instr_dupes,
            item_dupes,
            response_dupes,
        )

    counts = await replace_catalogue(
        session,
        instrument_rows=(
            LusciiInstrumentLocalisationRow(
                instrument_id=loc.instrument_id,
                instrument_version=loc.instrument_version,
                locale=loc.locale,
                name=loc.name,
                unit=loc.unit,
            )
            for loc in instrument_locs
        ),
        item_rows=(
            LusciiInstrumentItemLocalisationRow(
                item_id=loc.item_id,
                item_version=loc.item_version,
                locale=loc.locale,
                title=loc.title,
                subtitle=loc.subtitle,
                unit=loc.unit,
            )
            for loc in item_locs
        ),
        response_rows=(
            LusciiItemResponseLocalisationRow(
                item_response_id=loc.item_response_id,
                locale=loc.locale,
                response_text=loc.response_text,
            )
            for loc in response_locs
        ),
    )
    logger.info("luscii catalogue synced: %s", counts)
    return counts
