"""Export the synced Luscii catalogue tables into versioned JSON snapshots.

Writes one `<locale>.json` per locale under `apps/backend/data/luscii_catalogue/`
(committed to version control) so other checkouts can load the catalogue via
`backend:luscii-import` instead of the ~30-45 minute live sync. No token and
no upstream calls — reads the local DB only. Errors when the tables are empty.

Usage: `moon run backend:luscii-export` (or `uv run python -m scripts.export_luscii_catalogue`).
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.luscii.catalogue_snapshot import (
    DEFAULT_SNAPSHOT_DIR,
    SnapshotError,
    export_catalogue_snapshots,
)
from scripts._db import run_script

logger = logging.getLogger(__name__)


async def _export(session: AsyncSession) -> None:
    try:
        counts = await export_catalogue_snapshots(session)
    except SnapshotError as exc:
        raise SystemExit(str(exc)) from exc
    logger.info("done: %d locale file(s) in %s", len(counts), DEFAULT_SNAPSHOT_DIR)


def main() -> None:
    run_script(_export)


if __name__ == "__main__":
    main()
