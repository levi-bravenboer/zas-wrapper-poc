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

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.luscii import LusciiClient
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)

logger = logging.getLogger(__name__)


async def sync_luscii_catalogue(session: AsyncSession, client: LusciiClient) -> dict[str, int]:
    """Fetch all three catalogues and replace the local tables. Returns row counts."""

    # Three independent cursor chains — pages within one catalogue are
    # inherently sequential (cursor pagination), but the catalogues
    # themselves fetch concurrently: wall time ≈ the longest chain.
    instrument_locs, item_locs, response_locs = await asyncio.gather(
        client.get_instrument_localisations(),
        client.get_instrument_item_localisations(),
        client.get_item_response_localisations(),
    )

    await session.execute(delete(LusciiInstrumentLocalisationRow))
    await session.execute(delete(LusciiInstrumentItemLocalisationRow))
    await session.execute(delete(LusciiItemResponseLocalisationRow))

    session.add_all(
        LusciiInstrumentLocalisationRow(
            instrument_id=loc.instrument_id,
            instrument_version=loc.instrument_version,
            locale=loc.locale,
            name=loc.name,
            unit=loc.unit,
        )
        for loc in instrument_locs
    )
    session.add_all(
        LusciiInstrumentItemLocalisationRow(
            item_id=loc.item_id,
            item_version=loc.item_version,
            locale=loc.locale,
            title=loc.title,
            subtitle=loc.subtitle,
            unit=loc.unit,
        )
        for loc in item_locs
    )
    session.add_all(
        LusciiItemResponseLocalisationRow(
            item_response_id=loc.item_response_id,
            locale=loc.locale,
            response_text=loc.response_text,
        )
        for loc in response_locs
    )
    await session.flush()

    counts = {
        "instrument_localisations": len(instrument_locs),
        "instrument_item_localisations": len(item_locs),
        "item_response_localisations": len(response_locs),
    }
    logger.info("luscii catalogue synced: %s", counts)
    return counts
