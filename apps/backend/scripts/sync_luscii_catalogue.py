"""Sync the Luscii localisation catalogues into the local DB.

Requires `BACKEND_LUSCII_API_TOKEN` (token-presence rule); exits with an
error when unconfigured. ~1000 upstream requests (perPage 100); takes a few
minutes. Run rarely — the catalogue is near-static.

Usage: `moon run backend:luscii-sync` (or `uv run python -m scripts.sync_luscii_catalogue`).
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.deps import build_luscii_client
from app.core.settings import get_settings
from app.services.luscii.catalogue_sync import sync_luscii_catalogue
from scripts._db import run_script

logger = logging.getLogger(__name__)


async def _sync(session: AsyncSession) -> None:
    client = build_luscii_client(get_settings())
    if client is None:
        raise SystemExit(
            "BACKEND_LUSCII_API_TOKEN is not set — Luscii is unconfigured, nothing to sync."
        )
    try:
        counts = await sync_luscii_catalogue(session, client)
    finally:
        await client.aclose()
    logger.info("done: %s", counts)


def main() -> None:
    run_script(_sync)


if __name__ == "__main__":
    main()
