"""Full-replace writer for the local Luscii catalogue tables.

Shared by the live API sync (`catalogue_sync`) and the versioned JSON
snapshot import (`catalogue_snapshot`): both sources end in the same
delete-all + bulk-insert inside one transaction, keeping the replace
idempotent and the tables consistent for concurrent readers.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)

logger = logging.getLogger(__name__)


async def replace_catalogue(
    session: AsyncSession,
    *,
    instrument_rows: Iterable[LusciiInstrumentLocalisationRow],
    item_rows: Iterable[LusciiInstrumentItemLocalisationRow],
    response_rows: Iterable[LusciiItemResponseLocalisationRow],
) -> dict[str, int]:
    """Replace all three catalogue tables with the given rows. Returns counts."""
    instrument_rows = list(instrument_rows)
    item_rows = list(item_rows)
    response_rows = list(response_rows)

    await session.execute(delete(LusciiInstrumentLocalisationRow))
    await session.execute(delete(LusciiInstrumentItemLocalisationRow))
    await session.execute(delete(LusciiItemResponseLocalisationRow))

    session.add_all(instrument_rows)
    session.add_all(item_rows)
    session.add_all(response_rows)
    await session.flush()

    counts = {
        "instrument_localisations": len(instrument_rows),
        "instrument_item_localisations": len(item_rows),
        "item_response_localisations": len(response_rows),
    }
    logger.info("luscii catalogue replaced: %s", counts)
    return counts
