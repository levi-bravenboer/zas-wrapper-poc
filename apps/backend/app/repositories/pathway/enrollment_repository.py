"""Persistence for the runtime aggregate (slot #3).

Thin wrapper over `AsyncSession` — the engine is stateless, so the
repo only handles fetch + bulk insert + state save. Cross-aggregate
queries (per-patient summary, per-pathway dashboards) belong with
downstream slots.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pathway import (
    PathwayBlockExecution,
    PathwayDeferredFieldValue,
    PathwayEnrollment,
)


class EnrollmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, enrollment_id: UUID, tenant_id: UUID) -> PathwayEnrollment | None:
        stmt = select(PathwayEnrollment).where(
            PathwayEnrollment.id == enrollment_id,
            PathwayEnrollment.tenant_id == tenant_id,
            PathwayEnrollment.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def list_executions(
        self, enrollment_id: UUID
    ) -> list[PathwayBlockExecution]:
        stmt = (
            select(PathwayBlockExecution)
            .where(
                PathwayBlockExecution.enrollment_id == enrollment_id,
                PathwayBlockExecution.deleted_at.is_(None),
            )
            .order_by(PathwayBlockExecution.scheduled_at.asc().nulls_first())
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def list_deferred_values(
        self, enrollment_id: UUID
    ) -> list[PathwayDeferredFieldValue]:
        stmt = select(PathwayDeferredFieldValue).where(
            PathwayDeferredFieldValue.enrollment_id == enrollment_id,
            PathwayDeferredFieldValue.deleted_at.is_(None),
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def get_execution(
        self,
        execution_id: UUID,
        enrollment_id: UUID,
        tenant_id: UUID,
    ) -> PathwayBlockExecution | None:
        stmt = select(PathwayBlockExecution).where(
            PathwayBlockExecution.id == execution_id,
            PathwayBlockExecution.enrollment_id == enrollment_id,
            PathwayBlockExecution.tenant_id == tenant_id,
            PathwayBlockExecution.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def get_deferred_value(
        self,
        enrollment_id: UUID,
        block_template_id: UUID,
        attr: str,
    ) -> PathwayDeferredFieldValue | None:
        stmt = select(PathwayDeferredFieldValue).where(
            PathwayDeferredFieldValue.enrollment_id == enrollment_id,
            PathwayDeferredFieldValue.block_template_id == block_template_id,
            PathwayDeferredFieldValue.attr == attr,
            PathwayDeferredFieldValue.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()


__all__ = ["EnrollmentRepository"]
