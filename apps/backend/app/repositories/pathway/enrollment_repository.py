"""Persistence for the runtime aggregate (slot #3).

`EnrollmentRepository` is the `BaseRepository[PathwayEnrollment]`
single-model handle for enrollments; per-aggregate child rows
(executions, deferred values) are reached through helper methods
that join via `enrollment_id` so callers can stay on a single repo
seam without sprouting per-table repos.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.db.models.pathway import (
    PathwayBlockExecution,
    PathwayDeferredFieldValue,
    PathwayEnrollment,
)
from app.repositories.base import BaseRepository


class EnrollmentRepository(BaseRepository[PathwayEnrollment]):
    model = PathwayEnrollment

    async def get(self, enrollment_id: UUID, tenant_id: UUID) -> PathwayEnrollment | None:
        stmt = select(PathwayEnrollment).where(
            PathwayEnrollment.id == enrollment_id,
            PathwayEnrollment.tenant_id == tenant_id,
            PathwayEnrollment.deleted_at.is_(None),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def list_by_patient(
        self,
        patient_id: UUID,
        tenant_id: UUID,
    ) -> list[PathwayEnrollment]:
        stmt = (
            select(PathwayEnrollment)
            .where(
                PathwayEnrollment.patient_id == patient_id,
                PathwayEnrollment.tenant_id == tenant_id,
                PathwayEnrollment.deleted_at.is_(None),
            )
            .order_by(PathwayEnrollment.created_at.asc())
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def list_executions(self, enrollment_id: UUID) -> list[PathwayBlockExecution]:
        stmt = (
            select(PathwayBlockExecution)
            .where(
                PathwayBlockExecution.enrollment_id == enrollment_id,
                PathwayBlockExecution.deleted_at.is_(None),
            )
            .order_by(PathwayBlockExecution.scheduled_at.asc().nulls_first())
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def list_deferred_values(self, enrollment_id: UUID) -> list[PathwayDeferredFieldValue]:
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

    async def get_execution_by_id(
        self,
        execution_id: UUID,
        tenant_id: UUID,
    ) -> PathwayBlockExecution | None:
        stmt = select(PathwayBlockExecution).where(
            PathwayBlockExecution.id == execution_id,
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
