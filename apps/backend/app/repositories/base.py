from __future__ import annotations

from collections.abc import Mapping, Sequence
from math import ceil
from typing import ClassVar, Generic, TypeVar

import sqlalchemy as sa
from sqlalchemy import ColumnElement, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.core.errors import AppError
from app.db.audit import SESSION_ACTOR_KEY
from app.db.base import AuditableEntity, Entity, TenantOwnedEntity
from app.schemas._list.list_query import ListQuery, Operator
from app.schemas._list.page import Page

T = TypeVar("T", bound=Entity)


class BaseRepository(Generic[T]):
    """Base class for per-domain repositories.

    Subclasses set the `model` class attribute and may add entity-specific
    query methods. Repositories own SQL — services orchestrate, repositories
    fetch and persist. Repositories MUST NOT raise domain errors (return
    `None` / empty collections instead) and MUST NOT call `session.commit()`
    — the request-scoped session dependency in `app.db.engine` handles the
    transaction boundary.

    Soft delete: rows with `deleted_at IS NOT NULL` are filtered out by
    `list()`. Use `list_including_deleted()` to opt in. Custom subclass
    queries MUST add `where(model.deleted_at.is_(None))` unless they
    intentionally surface soft-deleted rows.

    `soft_delete(entity)` sets `deleted_at = func.now()` and, when the entity
    inherits `AuditableEntity`, sets `deleted_by` from
    `session.info[SESSION_ACTOR_KEY]` (left untouched when no actor is set).
    """

    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> list[T]:
        result = await self._session.execute(
            select(self.model).where(self.model.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def list_including_deleted(self) -> list[T]:
        result = await self._session.execute(select(self.model))
        return list(result.scalars().all())

    async def add(self, entity: T) -> T:
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def soft_delete(self, entity: T) -> None:
        """Mark the row as logically deleted. Does NOT remove it from the table."""

        entity.deleted_at = sa.func.now()  # type: ignore[assignment]
        if isinstance(entity, AuditableEntity):
            actor = self._session.info.get(SESSION_ACTOR_KEY)
            if actor is not None:
                entity.deleted_by = actor.id
        await self._session.flush()

    async def hard_delete(self, entity: T) -> None:
        """Physically remove the row. Prefer `soft_delete` unless retention rules forbid it."""

        await self._session.delete(entity)
        await self._session.flush()


class ListAllowListError(AppError):
    """Raised when a `ListQuery` references a field/operator outside the repo's allow-list.

    The dep layer (`list_query_params`) does not know the per-model allow-list,
    so this is the second line of defence: the repository validates before
    building SQL. Surfaced as HTTP 422 via the global `AppError` handler.
    """

    code = "list.allow_list"
    status_code = 422
    message = "Request references a field or operator not allowed for this list endpoint."


class BaseListRepository(BaseRepository[T]):
    """Adds typed `list_page(query)` returning `Page[T]`.

    Class-level allow-lists declare what is sortable, filterable, and which
    operators each field accepts. Soft-delete (`deleted_at IS NULL`) is
    applied by default; for `TenantOwnedEntity` subclasses the actor's
    `tenant_id` (`session.info[SESSION_ACTOR_KEY]`) is also applied.

    Subclasses MUST declare:

        orderable_fields: ClassVar[frozenset[str]] = frozenset({"created_at"})
        filterable_fields: ClassVar[Mapping[str, frozenset[Operator]]] = {
            "status": frozenset({"eq", "in", "not"}),
        }
        searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = (
            MyModel.email,
        )
        default_order: ClassVar[tuple[str, str]] = ("created_at", "desc")

    Subclasses extend the root select via `_extra_filters(query)`; overriding
    the root select itself is intentionally blocked — fork a separate method
    if you need a custom select.
    """

    orderable_fields: ClassVar[frozenset[str]] = frozenset()
    filterable_fields: ClassVar[Mapping[str, frozenset[Operator]]] = {}
    searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = ()
    default_order: ClassVar[tuple[str, str]] = ("created_at", "desc")

    def _extra_filters(self, query: ListQuery) -> Sequence[ColumnElement[bool]]:
        """Hook for subclass-specific predicates. Default: no extras."""
        del query
        return ()

    def _tenant_predicate(self) -> ColumnElement[bool] | None:
        if not issubclass(self.model, TenantOwnedEntity):
            return None
        actor = self._session.info.get(SESSION_ACTOR_KEY)
        if actor is None:
            return None
        tenant_id = getattr(actor, "tenant_id", None)
        if tenant_id is None:
            return None
        return self.model.tenant_id == tenant_id  # type: ignore[attr-defined]

    def _column(self, name: str) -> InstrumentedAttribute:
        try:
            return getattr(self.model, name)
        except AttributeError as exc:  # pragma: no cover - allow-list guards this
            msg = f"`{name}` is not a column on {self.model.__name__}"
            raise ListAllowListError(message=msg) from exc

    def _coerce_value(self, col: InstrumentedAttribute, value: str) -> object:
        """Coerce a URL string to the column's Python type.

        Strings reach the repo straight from query-string parsing
        (`ListQueryParamsDep`); SQLAlchemy will not implicitly cast
        `VARCHAR -> INTEGER`, so the repo coerces using `column.type`.
        """
        try:
            python_type = col.type.python_type
        except NotImplementedError:
            return value
        if python_type is bool:
            return value.lower() in {"1", "true", "yes", "on"}
        if python_type is str:
            return value
        try:
            return python_type(value)
        except (TypeError, ValueError):
            return value

    def _filter_predicate(
        self,
        field: str,
        operator: Operator,
        values: Sequence[str],
    ) -> ColumnElement[bool]:
        col = self._column(field)
        coerced = [self._coerce_value(col, v) for v in values]
        if operator == "eq":
            return col == coerced[0]
        if operator == "in":
            return col.in_(coerced)
        if operator == "not":
            return col.notin_(coerced)
        if operator == "gte":
            return col >= coerced[0]
        if operator == "lte":
            return col <= coerced[0]
        if operator == "contains":
            return sa.func.lower(col).like(f"%{values[0].lower()}%")
        msg = f"unsupported operator `{operator}`"  # pragma: no cover
        raise ListAllowListError(message=msg)

    def _validate_allow_lists(self, query: ListQuery) -> None:
        if query.order_by is not None and query.order_by not in self.orderable_fields:
            msg = f"`{query.order_by}` is not orderable on {self.model.__name__}"
            raise ListAllowListError(message=msg)
        for field, ops in query.filters.items():
            allowed = self.filterable_fields.get(field)
            if allowed is None:
                msg = f"`{field}` is not filterable on {self.model.__name__}"
                raise ListAllowListError(message=msg)
            for op in ops:
                if op not in allowed:
                    msg = f"operator `{op}` not allowed for `{field}` on {self.model.__name__}"
                    raise ListAllowListError(message=msg)

    async def list_page(self, query: ListQuery) -> Page[T]:
        self._validate_allow_lists(query)

        total_col = sa.func.count().over().label("__total")
        stmt = sa.select(self.model, total_col).where(self.model.deleted_at.is_(None))

        tenant_pred = self._tenant_predicate()
        if tenant_pred is not None:
            stmt = stmt.where(tenant_pred)

        for field, ops in query.filters.items():
            for op, values in ops.items():
                stmt = stmt.where(self._filter_predicate(field, op, values))

        if query.q is not None and self.searchable_fields:
            needle = f"%{query.q.lower()}%"
            stmt = stmt.where(
                or_(*[sa.func.lower(col).like(needle) for col in self.searchable_fields])
            )

        extras = self._extra_filters(query)
        for extra in extras:
            stmt = stmt.where(extra)

        order_field, order_dir = (
            (query.order_by, query.order) if query.order_by else self.default_order
        )
        order_col = self._column(order_field)
        order_clause = order_col.asc() if order_dir == "asc" else order_col.desc()
        stmt = stmt.order_by(order_clause.nullslast())

        offset = (query.page - 1) * query.page_size
        stmt = stmt.limit(query.page_size).offset(offset)

        result = await self._session.execute(stmt)
        rows = result.all()

        items = [row[0] for row in rows]
        if rows:
            total = int(rows[0][1])
        elif offset == 0:
            total = 0
        else:
            total = await self._count_only(query)
        total_pages = ceil(total / query.page_size) if total > 0 else 0
        return Page[T](
            items=items,
            page=query.page,
            page_size=query.page_size,
            total=total,
            total_pages=total_pages,
        )

    async def _count_only(self, query: ListQuery) -> int:
        """Fallback count when an oversize page yields zero rows.

        The window-function `count(*) OVER ()` lives on the row stream;
        empty result → empty count. This branch only fires when `page` is
        past the last page (rare; clients normally clamp).
        """
        stmt = (
            sa.select(sa.func.count())
            .select_from(self.model)
            .where(self.model.deleted_at.is_(None))
        )
        tenant_pred = self._tenant_predicate()
        if tenant_pred is not None:
            stmt = stmt.where(tenant_pred)
        for field, ops in query.filters.items():
            for op, values in ops.items():
                stmt = stmt.where(self._filter_predicate(field, op, values))
        if query.q is not None and self.searchable_fields:
            needle = f"%{query.q.lower()}%"
            stmt = stmt.where(
                or_(*[sa.func.lower(col).like(needle) for col in self.searchable_fields])
            )
        for extra in self._extra_filters(query):
            stmt = stmt.where(extra)
        return int(await self._session.scalar(stmt) or 0)
