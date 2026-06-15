"""Import the Luscii catalogue from the versioned JSON snapshots.

Full-replaces the three catalogue tables from the `<locale>.json` files under
`apps/backend/data/luscii_catalogue/` (committed to version control). Seconds
instead of the ~30-45 minute live sync; needs no `BACKEND_LUSCII_API_TOKEN`.
Run `backend:luscii-sync` + `backend:luscii-export` to refresh the snapshots.

Usage: `moon run backend:luscii-import` (or `uv run python -m scripts.import_luscii_catalogue`).
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.luscii.catalogue_snapshot import (
    SnapshotError,
    import_catalogue_snapshots,
)
from scripts._db import run_script

logger = logging.getLogger(__name__)


async def _import(session: AsyncSession) -> None:
    try:
        counts = await import_catalogue_snapshots(session)
    except SnapshotError as exc:
        raise SystemExit(str(exc)) from exc
    logger.info("done: %s", counts)


def main() -> None:
    run_script(_import)


if __name__ == "__main__":
    main()
