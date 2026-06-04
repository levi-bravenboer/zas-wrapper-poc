"""Outbox relay — applies pending authz reconciliation rows to Keto.

`process_pending` drains unprocessed `authz_outbox` rows in commit order,
reconciles each named object, and stamps `processed_at`. A row whose
reconcile fails stays pending (crash-safe: re-running re-derives from
Postgres, so replays are idempotent).

`run_relay_loop` is the in-process background worker started from the app
lifespan when `AUTHZ_KETO_ENABLED` is on. Single-pod PoC scope — the same
caveat as the realtime pub/sub (BL-050); horizontal scale moves this to a
dedicated worker.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models.authz import AuthzOutbox
from app.services.access.permissions.keto_client import KetoClient, KetoNamespace
from app.services.access.sync.reconciler import reconcile_object

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100


async def process_pending(session: AsyncSession, keto: KetoClient) -> int:
    """Drain pending outbox rows once. Returns the number processed."""

    result = await session.execute(
        select(AuthzOutbox)
        .where(AuthzOutbox.processed_at.is_(None))
        .order_by(AuthzOutbox.id)
        .limit(_BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )
    rows = result.scalars().all()
    processed = 0
    for row in rows:
        await reconcile_object(
            session,
            keto,
            namespace=_as_namespace(row.namespace),
            object_id=row.object_id,
        )
        row.processed_at = datetime.now(UTC)
        processed += 1
    await session.commit()
    return processed


def _as_namespace(raw: str) -> KetoNamespace:
    if raw not in ("Organisation", "CareTeam", "Patient"):
        raise ValueError(f"unknown authz namespace in outbox: {raw!r}")
    return raw  # type: ignore[return-value]  # narrowed by the guard above


async def run_relay_loop(
    session_factory: async_sessionmaker[AsyncSession],
    keto: KetoClient,
    *,
    poll_seconds: float = 2.0,
) -> None:
    """Poll-and-drain forever; transient failures back off and retry."""

    while True:
        try:
            async with session_factory() as session:
                processed = await process_pending(session, keto)
            if processed:
                logger.info("authz relay processed %d outbox rows", processed)
                continue  # drain immediately while there is work
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("authz relay iteration failed; retrying")
            await asyncio.sleep(poll_seconds * 5)
            continue
        await asyncio.sleep(poll_seconds)
