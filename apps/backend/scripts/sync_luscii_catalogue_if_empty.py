"""Run the Luscii catalogue sync only when the local table is empty.

Cheap probe: if `luscii_instrument_localisations` has any rows, exit
immediately. Otherwise delegate to :mod:`scripts.sync_luscii_catalogue` —
which takes a few minutes but only on first ever boot per deploy. Skips
silently when no Luscii token is configured.

Used by the container entrypoint so a fresh-volume deploy populates names
without a manual `moon run backend:luscii-sync` step.
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.deps import build_luscii_client
from app.core.settings import get_settings
from app.db.models import LusciiInstrumentLocalisationRow
from app.services.luscii.catalogue_sync import sync_luscii_catalogue
from scripts._db import run_script

logger = logging.getLogger(__name__)


async def _run(session: AsyncSession) -> None:
    settings = get_settings()
    if not getattr(settings, "luscii_api_token", None):
        logger.info("luscii catalogue sync: no token configured — skipped")
        return

    existing = await session.scalar(select(func.count()).select_from(LusciiInstrumentLocalisationRow))
    if (existing or 0) > 0:
        logger.info("luscii catalogue sync: table already populated (%s rows) — skipped", existing)
        return

    logging.getLogger("httpx").setLevel(logging.WARNING)
    client = build_luscii_client(settings)
    if client is None:
        logger.info("luscii catalogue sync: client unavailable — skipped")
        return

    logger.info("luscii catalogue sync: table empty — running full sync (takes a few minutes)")
    try:
        counts = await sync_luscii_catalogue(session, client)
    finally:
        await client.aclose()
    logger.info("luscii catalogue sync: done %s", counts)


def main() -> None:
    run_script(_run)


if __name__ == "__main__":
    main()
