# Shared query helper for collaboration repositories. Notes and attachments
# both list their rows joined to the authoring user's display name; only the
# author FK column and the ordering differ.

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.db.models.user import User


async def list_with_author_name(
    session: AsyncSession,
    model: type[Any],
    *,
    author_col: Any,
    tenant_id: UUID,
    predicates: Sequence[ColumnElement[bool]],
    order_by: Sequence[ColumnElement[Any]],
) -> Sequence[tuple[Any, str]]:
    """List live, tenant-scoped `model` rows paired with the author display name.

    Joins `model` to `users` on `author_col`, filters to the tenant and
    non-deleted rows plus the caller's `predicates`, and orders by `order_by`.
    """
    result = await session.execute(
        select(model, User.display_name)
        .join(User, User.id == author_col)
        .where(model.tenant_id == tenant_id, model.deleted_at.is_(None), *predicates)
        .order_by(*order_by)
    )
    return result.tuples().all()
