from __future__ import annotations

from collections.abc import Mapping
from typing import ClassVar

from sqlalchemy import ColumnElement

from app.db.models.audit import AuditEvent
from app.repositories.base import BaseListRepository
from app.schemas._list.list_query import Operator


class AuditEventRepository(BaseListRepository[AuditEvent]):
    model = AuditEvent

    orderable_fields: ClassVar[frozenset[str]] = frozenset({"created_at"})
    filterable_fields: ClassVar[Mapping[str, frozenset[Operator]]] = {
        "resource_type": frozenset({"eq"}),
        "resource_id": frozenset({"eq"}),
        "actor_id": frozenset({"eq"}),
        "action": frozenset({"eq", "in"}),
        "result": frozenset({"eq"}),
        "request_id": frozenset({"eq"}),
        "created_at": frozenset({"gte", "lte"}),
    }
    default_order: ClassVar[tuple[str, str]] = ("created_at", "desc")

    def _soft_delete_predicate(self) -> ColumnElement[bool] | None:
        # Append-only: no `deleted_at` column.
        return None
