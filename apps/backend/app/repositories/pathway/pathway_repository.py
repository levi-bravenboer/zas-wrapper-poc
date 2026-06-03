from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import NamedTuple
from uuid import UUID

from sqlalchemy import Select, and_, delete, func, or_, select
from sqlalchemy.orm import aliased

from app.db.models.pathway import (
    Pathway,
    PathwayBlock,
    PathwayBlockBranch,
    PathwayBlockDeferredField,
    PathwayEdge,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayTimeMarker,
    PathwayTimingValue,
    PathwayVersion,
)
from app.repositories.base import BaseRepository


class PathwaySummaryRow(NamedTuple):
    id: UUID
    name: str
    clinical_goal: str | None
    patient_goal: str | None
    updated_at: datetime
    block_count: int
    last_edited_at: datetime
    has_concept: bool
    concept_version_id: UUID | None
    latest_published_version_id: UUID | None
    latest_published_version_no: int | None
    latest_published_at: datetime | None


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
        # Derived rollups per `pathway-version` spec Requirement 11:
        # `block_count` aggregates every non-deleted block across the pathway's
        # versions (overview cares about workload, not which version owns it);
        # `last_edited_at` is the most recent version-row update; `has_concept`
        # + `concept_version_id` come from the partial-unique-indexed concept
        # row; `latest_published_*` comes from the (pathway_id, status,
        # published_at DESC) index. Kept as a single SELECT with subqueries to
        # avoid N+1; promotion to LATERAL is a future optimisation.
        concept_subq = (
            select(
                PathwayVersion.pathway_id.label("pathway_id"),
                PathwayVersion.id.label("concept_version_id"),
            )
            .where(
                PathwayVersion.status == "concept",
                PathwayVersion.deleted_at.is_(None),
            )
            .subquery()
        )
        published_subq = (
            select(
                PathwayVersion.pathway_id.label("pathway_id"),
                func.max(PathwayVersion.published_at).label("latest_published_at"),
            )
            .where(
                PathwayVersion.status == "published",
                PathwayVersion.deleted_at.is_(None),
            )
            .group_by(PathwayVersion.pathway_id)
            .subquery()
        )
        latest_published_row = aliased(PathwayVersion)
        block_count_subq = (
            select(
                PathwayVersion.pathway_id.label("pathway_id"),
                func.count(PathwayBlock.id).label("block_count"),
                func.max(PathwayVersion.updated_at).label("last_edited_at"),
            )
            .join(PathwayBlock, PathwayBlock.pathway_version_id == PathwayVersion.id, isouter=True)
            .where(
                PathwayVersion.deleted_at.is_(None),
                or_(PathwayBlock.id.is_(None), PathwayBlock.deleted_at.is_(None)),
            )
            .group_by(PathwayVersion.pathway_id)
            .subquery()
        )
        stmt = (
            select(
                Pathway.id,
                Pathway.name,
                Pathway.clinical_goal,
                Pathway.patient_goal,
                Pathway.updated_at,
                func.coalesce(block_count_subq.c.block_count, 0).label("block_count"),
                func.coalesce(block_count_subq.c.last_edited_at, Pathway.updated_at).label(
                    "last_edited_at"
                ),
                concept_subq.c.concept_version_id,
                latest_published_row.id.label("latest_published_version_id"),
                latest_published_row.version_no.label("latest_published_version_no"),
                latest_published_row.published_at.label("latest_published_at"),
            )
            .outerjoin(block_count_subq, block_count_subq.c.pathway_id == Pathway.id)
            .outerjoin(concept_subq, concept_subq.c.pathway_id == Pathway.id)
            .outerjoin(published_subq, published_subq.c.pathway_id == Pathway.id)
            .outerjoin(
                latest_published_row,
                and_(
                    latest_published_row.pathway_id == Pathway.id,
                    latest_published_row.status == "published",
                    latest_published_row.deleted_at.is_(None),
                    latest_published_row.published_at == published_subq.c.latest_published_at,
                ),
            )
            .where(Pathway.tenant_id == tenant_id, Pathway.deleted_at.is_(None))
            .order_by(Pathway.updated_at.desc())
        )
        result = await self._session.execute(stmt)
        return [
            PathwaySummaryRow(
                id=row.id,
                name=row.name,
                clinical_goal=row.clinical_goal,
                patient_goal=row.patient_goal,
                updated_at=row.updated_at,
                block_count=row.block_count,
                last_edited_at=row.last_edited_at,
                has_concept=row.concept_version_id is not None,
                concept_version_id=row.concept_version_id,
                latest_published_version_id=row.latest_published_version_id,
                latest_published_version_no=row.latest_published_version_no,
                latest_published_at=row.latest_published_at,
            )
            for row in result.all()
        ]

    async def get_many(self, pathway_ids: set[UUID] | list[UUID], tenant_id: UUID) -> list[Pathway]:
        """Fetch multiple pathways by id within a tenant, dropping soft-deleted
        rows. Used by the parent-references endpoint to attach names to ids
        returned by `find_pathway_link_parents`.
        """
        ids = list(pathway_ids)
        if not ids:
            return []
        result = await self._session.execute(
            select(Pathway)
            .where(
                Pathway.id.in_(ids),
                Pathway.tenant_id == tenant_id,
                Pathway.deleted_at.is_(None),
            )
            .order_by(Pathway.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, pathway_id: UUID, tenant_id: UUID) -> Pathway | None:
        result = await self._session.execute(
            select(Pathway).where(
                Pathway.id == pathway_id,
                Pathway.tenant_id == tenant_id,
                Pathway.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def child_summary_counts(self, pathway_version_id: UUID) -> tuple[int, int]:
        """Return `(lane_count, block_count)` for a single pathway version.
        Counts non-deleted rows. Used by the nested-pathway inspector summary
        endpoint to render a read-only child preview without fetching the
        full version definition.
        """
        lane_stmt = select(func.count(PathwayLane.id)).where(
            PathwayLane.pathway_version_id == pathway_version_id,
            PathwayLane.deleted_at.is_(None),
        )
        block_stmt = select(func.count(PathwayBlock.id)).where(
            PathwayBlock.pathway_version_id == pathway_version_id,
            PathwayBlock.deleted_at.is_(None),
        )
        lane_count = (await self._session.execute(lane_stmt)).scalar_one()
        block_count = (await self._session.execute(block_stmt)).scalar_one()
        return int(lane_count), int(block_count)

    async def find_pathway_link_parents(
        self,
        target_pathway_ids: list[UUID] | set[UUID],
        tenant_id: UUID,
    ) -> set[UUID]:
        """Return distinct pathway_ids that contain a non-deleted `pathway_link`
        block targeting any of the supplied `target_pathway_ids`. Scoped to a
        single tenant. Returns an empty set when the input is empty.

        Used by the nested-pathway cycle guard to walk the ancestor chain via
        repeated lookups; the bounded-depth loop lives in the caller.
        """
        targets = list(target_pathway_ids)
        if not targets:
            return set()
        target_strs = [str(t) for t in targets]
        stmt = (
            select(PathwayVersion.pathway_id)
            .join(PathwayBlock, PathwayBlock.pathway_version_id == PathwayVersion.id)
            .where(
                PathwayBlock.tenant_id == tenant_id,
                PathwayBlock.deleted_at.is_(None),
                PathwayBlock.type == "pathway_link",
                PathwayBlock.config["target_pathway_id"].astext.in_(target_strs),
            )
            .distinct()
        )
        result = await self._session.execute(stmt)
        return {row[0] for row in result.all()}

    async def fetch_children(self, pathway_version_id: UUID) -> PathwayChildren:
        phases = await self._scalars(
            select(PathwayPhase)
            .where(
                PathwayPhase.pathway_version_id == pathway_version_id,
                PathwayPhase.deleted_at.is_(None),
            )
            .order_by(PathwayPhase.ord)
        )
        lanes = await self._scalars(
            select(PathwayLane)
            .where(
                PathwayLane.pathway_version_id == pathway_version_id,
                PathwayLane.deleted_at.is_(None),
            )
            .order_by(PathwayLane.ord)
        )
        timing_values = await self._scalars(
            select(PathwayTimingValue).where(
                PathwayTimingValue.pathway_version_id == pathway_version_id,
                PathwayTimingValue.deleted_at.is_(None),
            )
        )
        blocks = await self._scalars(
            select(PathwayBlock).where(
                PathwayBlock.pathway_version_id == pathway_version_id,
                PathwayBlock.deleted_at.is_(None),
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
                PathwayEdge.pathway_version_id == pathway_version_id,
                PathwayEdge.deleted_at.is_(None),
            )
        )
        time_markers = await self._scalars(
            select(PathwayTimeMarker).where(
                PathwayTimeMarker.pathway_version_id == pathway_version_id,
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

    async def delete_children(self, pathway_version_id: UUID) -> None:
        """Hard-delete every child row of a pathway version, FK-safe order.

        Used by PUT replace (autosave) + version deletion cascade. The version
        row itself is left for the caller. `synchronize_session=False` skips
        per-instance state sync since child rows aren't held in this session.
        """

        opts = {"synchronize_session": False}
        await self._session.execute(
            delete(PathwayEdge).where(PathwayEdge.pathway_version_id == pathway_version_id),
            execution_options=opts,
        )
        await self._session.execute(
            delete(PathwayBlockBranch).where(
                PathwayBlockBranch.block_id.in_(
                    select(PathwayBlock.id).where(
                        PathwayBlock.pathway_version_id == pathway_version_id
                    )
                )
            ),
            execution_options=opts,
        )
        await self._session.execute(
            delete(PathwayBlockDeferredField).where(
                PathwayBlockDeferredField.block_id.in_(
                    select(PathwayBlock.id).where(
                        PathwayBlock.pathway_version_id == pathway_version_id
                    )
                )
            ),
            execution_options=opts,
        )
        await self._session.execute(
            delete(PathwayTimeMarker).where(
                PathwayTimeMarker.pathway_version_id == pathway_version_id
            ),
            execution_options=opts,
        )
        await self._session.execute(
            delete(PathwayBlock).where(PathwayBlock.pathway_version_id == pathway_version_id),
            execution_options=opts,
        )
        await self._session.execute(
            delete(PathwayLane).where(PathwayLane.pathway_version_id == pathway_version_id),
            execution_options=opts,
        )
        await self._session.execute(
            delete(PathwayPhase).where(PathwayPhase.pathway_version_id == pathway_version_id),
            execution_options=opts,
        )
        await self._session.execute(
            delete(PathwayTimingValue).where(
                PathwayTimingValue.pathway_version_id == pathway_version_id
            ),
            execution_options=opts,
        )
        await self._session.flush()

    async def _scalars[E](self, stmt: Select[tuple[E]]) -> list[E]:
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
