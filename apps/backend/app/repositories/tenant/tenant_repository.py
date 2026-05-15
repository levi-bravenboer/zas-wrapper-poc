from __future__ import annotations

from sqlalchemy import select

from app.db.models.tenant import Tenant
from app.repositories.base import BaseRepository


class TenantRepository(BaseRepository[Tenant]):
    model = Tenant

    async def get_by_slug(self, slug: str) -> Tenant | None:
        result = await self._session.execute(
            select(Tenant).where(Tenant.slug == slug, Tenant.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()
