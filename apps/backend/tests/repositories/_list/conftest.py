"""Fixtures for `BaseListRepository` integration tests.

`_DemoModel` is a throwaway `TenantOwnedEntity` declared at module import
time so `Base.metadata.create_all` (done once per session by the root
`db_engine` fixture) materialises its table alongside the production
models. It must not be imported anywhere outside this test package.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import ClassVar

import pytest
import sqlalchemy as sa
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, Mapped, mapped_column

from app.core.enums.user import Role
from app.db.base import TenantOwnedEntity
from app.db.models.tenant import Tenant
from app.db.models.user import User
from app.repositories.base import BaseListRepository
from app.schemas._list.list_query import Operator


class _DemoModel(TenantOwnedEntity):
    __tablename__ = "_demo_list_rows"
    __realtime_resource__: ClassVar[str | None] = "demo"

    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    score: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")


class DemoRepository(BaseListRepository[_DemoModel]):
    model = _DemoModel
    orderable_fields = frozenset({"name", "score", "created_at"})
    filterable_fields: ClassVar[dict[str, frozenset[Operator]]] = {
        "status": frozenset({"eq", "in", "not"}),
        "score": frozenset({"gte", "lte"}),
        "name": frozenset({"contains"}),
    }
    searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = (_DemoModel.name,)
    default_order = ("created_at", "desc")


class _StubActor:
    """Minimum shape the audit + tenant scoping hooks consume."""

    def __init__(self, *, user_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        self.id = user_id
        self.tenant_id = tenant_id


async def _seed_admin(session: AsyncSession, tenant: Tenant) -> User:
    """Insert a self-referencing admin user for FK audit columns."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        tenant_id=tenant.id,
        created_by=user_id,
        updated_by=user_id,
        email=f"admin-{tenant.slug}@test.local",
        password_hash="x",
        display_name=f"Admin {tenant.slug}",
        role=Role.ADMIN,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def two_tenants(
    db_session: AsyncSession,
) -> AsyncIterator[tuple[Tenant, Tenant, User, User]]:
    a = Tenant(id=uuid.uuid4(), slug="alpha", name="Alpha")
    b = Tenant(id=uuid.uuid4(), slug="beta", name="Beta")
    db_session.add_all([a, b])
    await db_session.flush()
    a_admin = await _seed_admin(db_session, a)
    b_admin = await _seed_admin(db_session, b)
    await db_session.commit()
    a_id, b_id = a.id, b.id
    yield a, b, a_admin, b_admin
    await db_session.execute(delete(_DemoModel))
    await db_session.execute(delete(User).where(User.tenant_id.in_([a_id, b_id])))
    await db_session.execute(delete(Tenant).where(Tenant.id.in_([a_id, b_id])))
    await db_session.commit()


def make_actor(*, user_id: uuid.UUID, tenant_id: uuid.UUID) -> _StubActor:
    return _StubActor(user_id=user_id, tenant_id=tenant_id)


__all__ = ["DemoRepository", "_DemoModel", "make_actor", "two_tenants"]
