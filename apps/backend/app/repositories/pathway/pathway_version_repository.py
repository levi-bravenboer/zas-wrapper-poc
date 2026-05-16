from __future__ import annotations

from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import func, select

from app.db.models.pathway import PathwayVersion
from app.repositories.base import BaseRepository


class PathwayVersionRepository(BaseRepository[PathwayVersion]):
    model = PathwayVersion

    async def get_in_pathway(
        self, version_id: UUID, pathway_id: UUID
    ) -> PathwayVersion | None:
        result = await self._session.execute(
            select(PathwayVersion).where(
                PathwayVersion.id == version_id,
                PathwayVersion.pathway_id == pathway_id,
                PathwayVersion.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_concept(self, pathway_id: UUID) -> PathwayVersion | None:
        result = await self._session.execute(
            select(PathwayVersion).where(
                PathwayVersion.pathway_id == pathway_id,
                PathwayVersion.status == "concept",
                PathwayVersion.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_latest_published(self, pathway_id: UUID) -> PathwayVersion | None:
        result = await self._session.execute(
            select(PathwayVersion)
            .where(
                PathwayVersion.pathway_id == pathway_id,
                PathwayVersion.status == "published",
                PathwayVersion.deleted_at.is_(None),
            )
            .order_by(PathwayVersion.published_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def resolve_for_view(self, pathway_id: UUID) -> PathwayVersion | None:
        """Concept-if-exists else latest-published (per spec Requirement 9)."""
        concept = await self.get_concept(pathway_id)
        if concept is not None:
            return concept
        return await self.get_latest_published(pathway_id)

    async def list_for_pathway(self, pathway_id: UUID) -> list[PathwayVersion]:
        result = await self._session.execute(
            select(PathwayVersion)
            .where(
                PathwayVersion.pathway_id == pathway_id,
                PathwayVersion.deleted_at.is_(None),
            )
            .order_by(PathwayVersion.version_no.desc())
        )
        return list(result.scalars().all())

    async def next_version_no(self, pathway_id: UUID) -> int:
        result = await self._session.execute(
            select(func.coalesce(func.max(PathwayVersion.version_no), 0)).where(
                PathwayVersion.pathway_id == pathway_id
            )
        )
        return int(result.scalar_one()) + 1

    async def add(self, version: PathwayVersion) -> PathwayVersion:
        self._session.add(version)
        await self._session.flush()
        return version

    async def mark_published(
        self,
        version: PathwayVersion,
        *,
        published_by: UUID,
        label: str | None,
        note: str | None,
    ) -> None:
        version.status = "published"
        version.published_at = sa.func.now()  # type: ignore[assignment]
        version.published_by = published_by
        version.label = label
        version.note = note
        await self._session.flush()
        await self._session.refresh(version, ["published_at"])
