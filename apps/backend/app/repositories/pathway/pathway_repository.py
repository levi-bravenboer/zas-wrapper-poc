from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import NamedTuple
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import func, select

from app.db.models.pathway import (
    Pathway,
    PathwayBlock,
    PathwayBlockDeferredField,
    PathwayBlockBranch,
    PathwayEdge,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayTimeMarker,
    PathwayTimingValue,
)
from app.repositories.base import BaseRepository


class PathwaySummaryRow(NamedTuple):
    id: UUID
    name: str
    clinical_goal: str | None
    patient_goal: str | None
    updated_at: datetime
    block_count: int


@dataclass(slots=True)
class PathwayChildren:
    phases: list[PathwayPhase]
    lanes: list[PathwayLane]
    timing_values: list[PathwayTimingValue]
    blocks: list[PathwayBlock]
    branches: list[PathwayBlockBranch]
    edges: list[PathwayEdge]
    time_markers: list[PathwayTimeMarker]
    deferred_fields: list[PathwayBlockDeferredField]


class PathwayRepository(BaseRepository[Pathway]):
    model = Pathway

    async def list_summaries(self, tenant_id: UUID) -> list[PathwaySummaryRow]:
        block_count = (
            select(
                PathwayBlock.pathway_id.label("pathway_id"),
                func.count(PathwayBlock.id).label("block_count"),
            )
            .where(PathwayBlock.deleted_at.is_(None))
            .group_by(PathwayBlock.pathway_id)
            .subquery()
        )
        stmt = (
            select(
                Pathway.id,
                Pathway.name,
                Pathway.clinical_goal,
                Pathway.patient_goal,
                Pathway.updated_at,
                func.coalesce(block_count.c.block_count, 0).label("block_count"),
            )
            .outerjoin(block_count, block_count.c.pathway_id == Pathway.id)
            .where(Pathway.tenant_id == tenant_id, Pathway.deleted_at.is_(None))
            .order_by(Pathway.updated_at.desc())
        )
        result = await self._session.execute(stmt)
        return [
            PathwaySummaryRow(
                row.id,
                row.name,
                row.clinical_goal,
                row.patient_goal,
                row.updated_at,
                row.block_count,
            )
            for row in result.all()
        ]

    async def get(self, pathway_id: UUID, tenant_id: UUID) -> Pathway | None:
        result = await self._session.execute(
            select(Pathway).where(
                Pathway.id == pathway_id,
                Pathway.tenant_id == tenant_id,
                Pathway.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def fetch_children(self, pathway_id: UUID) -> PathwayChildren:
        phases = await self._scalars(
            select(PathwayPhase)
            .where(PathwayPhase.pathway_id == pathway_id, PathwayPhase.deleted_at.is_(None))
            .order_by(PathwayPhase.ord)
        )
        lanes = await self._scalars(
            select(PathwayLane)
            .where(PathwayLane.pathway_id == pathway_id, PathwayLane.deleted_at.is_(None))
            .order_by(PathwayLane.ord)
        )
        timing_values = await self._scalars(
            select(PathwayTimingValue).where(
                PathwayTimingValue.pathway_id == pathway_id,
                PathwayTimingValue.deleted_at.is_(None),
            )
        )
        blocks = await self._scalars(
            select(PathwayBlock).where(
                PathwayBlock.pathway_id == pathway_id, PathwayBlock.deleted_at.is_(None)
            )
        )
        block_ids = [b.id for b in blocks]
        branches: list[PathwayBlockBranch] = (
            await self._scalars(
                select(PathwayBlockBranch)
                .where(
                    PathwayBlockBranch.block_id.in_(block_ids),
                    PathwayBlockBranch.deleted_at.is_(None),
                )
                .order_by(PathwayBlockBranch.ord)
            )
            if block_ids
            else []
        )
        edges = await self._scalars(
            select(PathwayEdge).where(
                PathwayEdge.pathway_id == pathway_id, PathwayEdge.deleted_at.is_(None)
            )
        )
        time_markers = await self._scalars(
            select(PathwayTimeMarker).where(
                PathwayTimeMarker.pathway_id == pathway_id,
                PathwayTimeMarker.deleted_at.is_(None),
            )
        )
        deferred_fields: list[PathwayBlockDeferredField] = (
            await self._scalars(
                select(PathwayBlockDeferredField).where(
                    PathwayBlockDeferredField.block_id.in_(block_ids),
                    PathwayBlockDeferredField.deleted_at.is_(None),
                )
            )
            if block_ids
            else []
        )
        return PathwayChildren(
            phases=list(phases),
            lanes=list(lanes),
            timing_values=list(timing_values),
            blocks=list(blocks),
            branches=list(branches),
            edges=list(edges),
            time_markers=list(time_markers),
            deferred_fields=list(deferred_fields),
        )

    async def lane_kinds_by_code(self) -> dict[str, PathwayLaneKind]:
        result = await self._session.execute(
            select(PathwayLaneKind).where(PathwayLaneKind.deleted_at.is_(None))
        )
        return {row.code: row for row in result.scalars().all()}

    async def delete_children(self, pathway_id: UUID) -> None:
        """Hard-delete every child row of a pathway, FK-safe order.

        Used by PUT replace + DELETE cascade. The pathway row itself is
        left for the caller to either persist (replace) or soft-delete
        (delete). `synchronize_session=False` skips per-instance state
        sync since child rows aren't held in this session.
        """

        opts = {"synchronize_session": False}
        await self._session.execute(
            sa.delete(PathwayEdge).where(PathwayEdge.pathway_id == pathway_id),
            execution_options=opts,
        )
        await self._session.execute(
            sa.delete(PathwayBlockBranch).where(
                PathwayBlockBranch.block_id.in_(
                    select(PathwayBlock.id).where(PathwayBlock.pathway_id == pathway_id)
                )
            ),
            execution_options=opts,
        )
        await self._session.execute(
            sa.delete(PathwayBlockDeferredField).where(
                PathwayBlockDeferredField.block_id.in_(
                    select(PathwayBlock.id).where(PathwayBlock.pathway_id == pathway_id)
                )
            ),
            execution_options=opts,
        )
        await self._session.execute(
            sa.delete(PathwayTimeMarker).where(PathwayTimeMarker.pathway_id == pathway_id),
            execution_options=opts,
        )
        await self._session.execute(
            sa.delete(PathwayBlock).where(PathwayBlock.pathway_id == pathway_id),
            execution_options=opts,
        )
        await self._session.execute(
            sa.delete(PathwayLane).where(PathwayLane.pathway_id == pathway_id),
            execution_options=opts,
        )
        await self._session.execute(
            sa.delete(PathwayPhase).where(PathwayPhase.pathway_id == pathway_id),
            execution_options=opts,
        )
        await self._session.execute(
            sa.delete(PathwayTimingValue).where(PathwayTimingValue.pathway_id == pathway_id),
            execution_options=opts,
        )
        await self._session.flush()

    async def _scalars[E](self, stmt: sa.Select[tuple[E]]) -> list[E]:
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
