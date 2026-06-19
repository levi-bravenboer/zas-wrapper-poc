from __future__ import annotations

from collections.abc import Mapping
from typing import ClassVar
from uuid import UUID

from sqlalchemy import ColumnElement, select

from app.db.audit import SESSION_ACTOR_KEY
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
        "event_code": frozenset({"eq", "in"}),
        "request_id": frozenset({"eq"}),
        "patient_id": frozenset({"eq"}),
        "purpose_of_use": frozenset({"eq", "in"}),
        "created_at": frozenset({"gte", "lte"}),
    }
    default_order: ClassVar[tuple[str, str]] = ("created_at", "desc")

    async def latest_for_resource(self, resource_type: str, resource_id: UUID) -> AuditEvent | None:
        """Most recent event anchored to a resource (no tenant scoping — used by
        in-band emit policy that runs before the actor's tenant is asserted)."""
        return await self._session.scalar(
            select(AuditEvent)
            .where(
                AuditEvent.resource_type == resource_type,
                AuditEvent.resource_id == resource_id,
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(1)
        )

    def _soft_delete_predicate(self) -> ColumnElement[bool] | None:
        # Append-only: no `deleted_at` column.
        return None

    def _tenant_predicate(self) -> ColumnElement[bool] | None:
        # AuditEvent inherits Base (not TenantOwnedEntity), so the base hook
        # skips it — but it carries a denormalised `tenant_id`. Scope the trail
        # to the caller's tenant so an admin never reads another tenant's rows.
        # NULL-tenant rows (anonymous/system events) are excluded — platform
        # events, not tenant-visible.
        actor = self._session.info.get(SESSION_ACTOR_KEY)
        tenant_id = getattr(actor, "tenant_id", None) if actor is not None else None
        if tenant_id is None:
            return None
        return AuditEvent.tenant_id == tenant_id
