from __future__ import annotations

import uuid

import pytest
import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.tenant import Tenant
from app.repositories.base import ListAllowListError
from app.schemas._list.list_query import ListQuery

from app.db.models.user import User

from tests.repositories._list.conftest import DemoRepository, _DemoModel, make_actor


async def _seed(
    session: AsyncSession,
    *,
    tenant: Tenant,
    name: str,
    status: str = "open",
    score: int = 0,
    deleted: bool = False,
) -> _DemoModel:
    actor = session.info.get(SESSION_ACTOR_KEY)
    if actor is None:
        msg = "Test must set session.info[SESSION_ACTOR_KEY]; audit hook needs an actor."
        raise RuntimeError(msg)
    row = _DemoModel(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name=name,
        status=status,
        score=score,
    )
    if deleted:
        row.deleted_at = sa.func.now()
    session.add(row)
    await session.flush()
    return row


@pytest.fixture
async def alpha_session(
    db_session: AsyncSession,
    two_tenants: tuple[Tenant, Tenant, User, User],
) -> AsyncSession:
    alpha, _, alpha_admin, _ = two_tenants
    db_session.info[SESSION_ACTOR_KEY] = make_actor(user_id=alpha_admin.id, tenant_id=alpha.id)
    return db_session


async def test_page_zero_rejected(alpha_session: AsyncSession) -> None:
    # The dep clamps page >= 1 via Pydantic, but defence-in-depth: ListQuery rejects.
    with pytest.raises(ValueError):
        ListQuery(page=0)


async def test_pagination_boundaries(
    alpha_session: AsyncSession, two_tenants: tuple[Tenant, Tenant, User, User]
) -> None:
    alpha, *_ = two_tenants
    for i in range(7):
        await _seed(alpha_session, tenant=alpha, name=f"row-{i:02d}", score=i)
    await alpha_session.commit()

    repo = DemoRepository(alpha_session)
    page = await repo.list_page(ListQuery(page=1, page_size=5, order_by="score", order="asc"))
    assert page.total == 7
    assert page.total_pages == 2
    assert len(page.items) == 5

    overflow = await repo.list_page(ListQuery(page=99, page_size=5))
    assert overflow.total == 7
    assert overflow.items == []


async def test_soft_delete_filtered_by_default(
    alpha_session: AsyncSession, two_tenants: tuple[Tenant, Tenant, User, User]
) -> None:
    alpha, *_ = two_tenants
    await _seed(alpha_session, tenant=alpha, name="visible")
    await _seed(alpha_session, tenant=alpha, name="ghost", deleted=True)
    await alpha_session.commit()

    page = await DemoRepository(alpha_session).list_page(ListQuery())
    names = {r.name for r in page.items}
    assert names == {"visible"}


async def test_tenant_isolation(
    db_session: AsyncSession,
    two_tenants: tuple[Tenant, Tenant, User, User],
) -> None:
    alpha, beta, alpha_admin, beta_admin = two_tenants

    db_session.info[SESSION_ACTOR_KEY] = make_actor(user_id=alpha_admin.id, tenant_id=alpha.id)
    await _seed(db_session, tenant=alpha, name="a-row")
    await db_session.commit()

    db_session.info[SESSION_ACTOR_KEY] = make_actor(user_id=beta_admin.id, tenant_id=beta.id)
    await _seed(db_session, tenant=beta, name="b-row")
    await db_session.commit()

    # Query as beta actor — must not see alpha's row.
    page = await DemoRepository(db_session).list_page(ListQuery())
    assert {r.name for r in page.items} == {"b-row"}


async def test_order_by_outside_allow_list_rejected(alpha_session: AsyncSession) -> None:
    repo = DemoRepository(alpha_session)
    with pytest.raises(ListAllowListError):
        await repo.list_page(ListQuery(order_by="password_hash"))


async def test_filter_field_outside_allow_list_rejected(alpha_session: AsyncSession) -> None:
    repo = DemoRepository(alpha_session)
    with pytest.raises(ListAllowListError):
        await repo.list_page(ListQuery(filters={"password_hash": {"eq": ["x"]}}))


async def test_filter_operator_outside_per_field_allow_list_rejected(
    alpha_session: AsyncSession,
) -> None:
    repo = DemoRepository(alpha_session)
    # `status` allows eq/in/not but not gte.
    with pytest.raises(ListAllowListError):
        await repo.list_page(ListQuery(filters={"status": {"gte": ["x"]}}))


async def test_each_operator_produces_correct_filter(
    alpha_session: AsyncSession, two_tenants: tuple[Tenant, Tenant, User, User]
) -> None:
    alpha, *_ = two_tenants
    await _seed(alpha_session, tenant=alpha, name="alice", status="open", score=10)
    await _seed(alpha_session, tenant=alpha, name="bob", status="closed", score=20)
    await _seed(alpha_session, tenant=alpha, name="carol", status="open", score=30)
    await alpha_session.commit()

    repo = DemoRepository(alpha_session)

    eq = await repo.list_page(ListQuery(filters={"status": {"eq": ["closed"]}}))
    assert {r.name for r in eq.items} == {"bob"}

    in_ = await repo.list_page(ListQuery(filters={"status": {"in": ["closed", "open"]}}))
    assert {r.name for r in in_.items} == {"alice", "bob", "carol"}

    not_ = await repo.list_page(ListQuery(filters={"status": {"not": ["closed"]}}))
    assert {r.name for r in not_.items} == {"alice", "carol"}

    gte = await repo.list_page(ListQuery(filters={"score": {"gte": ["20"]}}))
    assert {r.name for r in gte.items} == {"bob", "carol"}

    lte = await repo.list_page(ListQuery(filters={"score": {"lte": ["20"]}}))
    assert {r.name for r in lte.items} == {"alice", "bob"}

    contains = await repo.list_page(ListQuery(filters={"name": {"contains": ["O"]}}))
    assert {r.name for r in contains.items} == {"bob", "carol"}


async def test_q_search_across_searchable_fields(
    alpha_session: AsyncSession, two_tenants: tuple[Tenant, Tenant, User, User]
) -> None:
    alpha, *_ = two_tenants
    await _seed(alpha_session, tenant=alpha, name="alice")
    await _seed(alpha_session, tenant=alpha, name="bob")
    await alpha_session.commit()

    page = await DemoRepository(alpha_session).list_page(ListQuery(q="ali"))
    assert {r.name for r in page.items} == {"alice"}


async def test_list_page_runs_single_query(
    alpha_session: AsyncSession, two_tenants: tuple[Tenant, Tenant, User, User]
) -> None:
    alpha, *_ = two_tenants
    for i in range(3):
        await _seed(alpha_session, tenant=alpha, name=f"row-{i}")
    await alpha_session.commit()

    engine = alpha_session.bind
    statements: list[str] = []

    @event.listens_for(engine.sync_engine, "before_cursor_execute")
    def _capture(conn, cursor, statement, parameters, context, executemany):  # noqa: ANN001
        if "_demo_list_rows" in statement:
            statements.append(statement)

    try:
        await DemoRepository(alpha_session).list_page(ListQuery())
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _capture)

    assert len(statements) == 1
    assert "count" in statements[0].lower()
