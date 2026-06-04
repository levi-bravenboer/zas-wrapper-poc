"""Expiry sweep — re-enqueues objects whose time-bounded grants lapsed.

Tuple derivation applies time predicates (`access_grants.expires_at > now`,
`external_grants.period_end > now`) but nothing re-derives a patient when a
deadline passes WITHOUT a row mutation — no flush, no outbox row. This loop
closes that gap: each pass enqueues an `AuthzOutbox` row for every patient
holding a grant that expired since the previous pass, and the relay's next
drain re-derives (dropping the lapsed tuples).

The first pass after process start uses an unbounded window, so grants that
expired while the process was down are re-enqueued too — reconciles are
idempotent, so the catch-up is harmless. Failures never skip rows
permanently: `last_run` only advances after a successful pass.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models.access.access_grant import AccessGrant
from app.db.models.access.external_access import ExternalGrant
from app.db.models.authz import AuthzOutbox

logger = logging.getLogger(__name__)


async def sweep_expired_grants(
    session: AsyncSession, *, since: datetime | None, now: datetime
) -> int:
    """Enqueue outbox rows for patients whose grants lapsed in (since, now]."""

    pending: set = set()

    break_glass = select(AccessGrant.patient_id).where(
        AccessGrant.deleted_at.is_(None),
        AccessGrant.revoked_at.is_(None),
        AccessGrant.expires_at <= now,
        *([AccessGrant.expires_at > since] if since is not None else []),
    )
    pending.update(row[0] for row in (await session.execute(break_glass)).all())

    external = select(ExternalGrant.patient_id).where(
        ExternalGrant.deleted_at.is_(None),
        ExternalGrant.period_end.is_not(None),
        ExternalGrant.period_end <= now,
        *([ExternalGrant.period_end > since] if since is not None else []),
    )
    pending.update(row[0] for row in (await session.execute(external)).all())

    for patient_id in pending:
        session.add(AuthzOutbox(namespace="Patient", object_id=patient_id))
    await session.commit()
    return len(pending)


async def run_sweep_loop(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    poll_seconds: float = 30.0,
) -> None:
    """Periodic sweep; companion to `relay.run_relay_loop`."""

    last_run: datetime | None = None  # unbounded first pass = restart catch-up
    while True:
        now = datetime.now(UTC)
        try:
            async with session_factory() as session:
                swept = await sweep_expired_grants(session, since=last_run, now=now)
            if swept:
                logger.info("authz sweep enqueued %d lapsed-grant patients", swept)
            last_run = now
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("authz sweep iteration failed; retrying")
        await asyncio.sleep(poll_seconds)
