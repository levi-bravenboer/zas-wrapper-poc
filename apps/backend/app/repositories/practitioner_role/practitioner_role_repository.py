from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import ClassVar

from sqlalchemy import ColumnElement
from sqlalchemy.orm import InstrumentedAttribute

from app.db.models.practitioner import PractitionerRole
from app.repositories.base import BaseListRepository
from app.schemas._list.list_query import Operator


class PractitionerRoleRepository(BaseListRepository[PractitionerRole]):
    model = PractitionerRole

    orderable_fields: ClassVar[frozenset[str]] = frozenset(
        {"period_start", "period_end", "is_primary", "code"}
    )
    filterable_fields: ClassVar[Mapping[str, frozenset[Operator]]] = {
        "practitioner_id": frozenset({"eq", "in"}),
        "organisation_id": frozenset({"eq", "in"}),
        "code": frozenset({"eq", "in"}),
        "is_primary": frozenset({"eq"}),
        "is_open": frozenset({"eq"}),
    }
    searchable_fields: ClassVar[tuple[InstrumentedAttribute, ...]] = ()
    default_order: ClassVar[tuple[str, str]] = ("period_start", "desc")

    def _filter_predicate(
        self,
        field: str,
        operator: Operator,
        values: Sequence[str],
    ) -> ColumnElement[bool]:
        if field == "is_open":
            wants_open = values[0].lower() in {"1", "true", "yes", "on"}
            return (
                PractitionerRole.period_end.is_(None)
                if wants_open
                else PractitionerRole.period_end.is_not(None)
            )
        return super()._filter_predicate(field, operator, values)
