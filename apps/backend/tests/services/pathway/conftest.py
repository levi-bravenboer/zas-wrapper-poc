from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.pathway import Pathway, PathwayLaneKind, PathwayVersion
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from app.services.pathway.catalogue import SEEDED_LANE_KINDS
from scripts.seed_tenant import ZAS_TENANT_ID
from scripts.seed_users import ADMIN_DISPLAY_NAME, ADMIN_EMAIL, ADMIN_USER_ID


@pytest.fixture(autouse=True)
async def _autoclean_pathway_tables(request: pytest.FixtureRequest) -> AsyncIterator[None]:
    """Wipe pathway domain rows around every test.

    Order matters: `pathway_lane.pathway_lane_kind_id` is ON DELETE RESTRICT,
    so kinds must be cleared after pathways. `pathway` rows cascade to all
    child tables via `pathway_id` FK ON DELETE CASCADE. Tenants/users come
    from the global `clean_tenants` fixture but pathway rows would block
    that wipe (pathway.tenant_id is RESTRICT), so we run first.

    Tests marked with `@pytest.mark.no_db` opt out — used for pure
    value-object / parser unit tests that touch zero ORM models and
    therefore should not pay the DB-fixture cost (which also fails when
    the test session runs without a live database).
    """

    if request.node.get_closest_marker("no_db") is not None:
        yield
        return
    db_session: AsyncSession = request.getfixturevalue("db_session")
    await _wipe(db_session)
    yield
    await _wipe(db_session)


async def _wipe(session: AsyncSession) -> None:
    await session.execute(delete(Pathway))
    await session.execute(delete(PathwayLaneKind))
    await session.execute(delete(User))
    await session.execute(delete(Tenant))
    await session.commit()


@pytest.fixture
def session_actor() -> SessionUser:
    """Stamp pathway rows with the bootstrap admin actor.

    Built from `scripts/seed_users` constants so it's wire-compatible with
    rows the `seeded_zas_users` fixture inserts — without taking a fixture
    dep on `db_session` (which would create a recursive fixture cycle since
    `db_session` itself consumes `session_actor`).
    """

    return SessionUser(
        id=ADMIN_USER_ID,
        email=ADMIN_EMAIL,
        display_name=ADMIN_DISPLAY_NAME,
        tenant_id=ZAS_TENANT_ID,
        role=Role.ADMIN,
    )


@pytest.fixture
async def lane_kinds(
    db_session: AsyncSession, seeded_zas_users: list[User]
) -> AsyncIterator[dict[str, PathwayLaneKind]]:
    """Seed the four canonical lane kinds. Migration seeds them in dev/prod;
    tests recreate the schema via `Base.metadata.create_all`, which does not
    run `op.execute` seeds, so we re-seed here. Depends on `seeded_zas_users`
    so the admin row exists for FK targets on later pathway children."""

    del seeded_zas_users
    rows = {
        code: PathwayLaneKind(id=uuid.uuid4(), code=code, label=label)
        for code, label in SEEDED_LANE_KINDS
    }
    db_session.add_all(rows.values())
    await db_session.commit()
    yield rows
    # Cleanup is owned by the autouse `_autoclean_pathway_tables` fixture,
    # which wipes Pathway → PathwayLaneKind in FK-safe order. Deleting kinds
    # here would race against lanes still referencing them.


@pytest.fixture
async def empty_pathway(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> Pathway:
    del lane_kinds  # ordering dep — lane kinds must exist before pathway children
    pathway = Pathway(
        name="Test pathway",
        clinical_goal="Restore function.",
        patient_goal="Get back to daily life.",
    )
    db_session.add(pathway)
    await db_session.flush()
    initial_version = PathwayVersion(
        pathway_id=pathway.id,
        version_no=1,
        status="concept",
        kind="initial",
    )
    db_session.add(initial_version)
    await db_session.commit()
    return pathway


@pytest.fixture
async def tenant(seeded_zas_tenant: Tenant) -> Tenant:
    return seeded_zas_tenant
