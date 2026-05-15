"""Short-lived async engine + session for operational scripts.

Scripts MUST NOT depend on FastAPI app state. Reuse the engine + session
factory builders from `app.db.engine` so connection kwargs (pool_pre_ping,
expire_on_commit, ...) stay defined in one place. `run_script` wraps the
common `configure_logging + asyncio.run` entry-point pattern shared by
every `scripts/seed_*.py` module.

`script_session(*, actor=None)` writes the actor into
`session.info[SESSION_ACTOR_KEY]` so the audit hook (`app/db/audit.py`)
auto-stamps `tenant_id` / `created_by` / `updated_by` on auditable rows
the script flushes. Bootstrap scripts that pre-date a user (`seed_tenant`)
pass `actor=None`; later seeds build an in-process `SessionUser` from the
just-inserted admin and pass it in.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import configure_logging
from app.core.settings import get_settings
from app.db.audit import SESSION_ACTOR_KEY
from app.db.engine import create_engine, create_session_factory


@asynccontextmanager
async def script_session(*, actor: Any = None) -> AsyncIterator[AsyncSession]:
    engine = create_engine(get_settings())
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            if actor is not None:
                session.info[SESSION_ACTOR_KEY] = actor
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
    finally:
        await engine.dispose()


def run_script(
    coro_factory: Callable[[AsyncSession], Awaitable[None]],
    *,
    actor: Any = None,
) -> None:
    """Configure logging then run `coro_factory(session)` inside `script_session()`.

    Every `scripts/seed_*.py` module exposes a sync `main()` entry point that
    forwards to this helper, so the logging + asyncio + session wiring lives
    in exactly one place.
    """

    configure_logging(get_settings())

    async def _run() -> None:
        async with script_session(actor=actor) as session:
            await coro_factory(session)

    asyncio.run(_run())
