"""Specialism master data + carepath/role link management (admin surface).

Replace-set semantics on the link endpoints keep the API idempotent and the
UI simple (checkbox sets). Every mutation flows through the ORM so the
authz outbox hook enqueues the affected `Specialism` / `Carepath` objects
in the same transaction — no manual tuple writes here.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pathway.pathway import Pathway
from app.db.models.pathway.pathway_access import PathwayPractitioner, PathwaySpecialism
from app.db.models.practitioner.practitioner_role import PractitionerRole
from app.db.models.practitioner.specialism import PractitionerRoleSpecialism, Specialism
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from app.services.access.scoping.errors import (
    SpecialismCodeTakenError,
    SpecialismInUseError,
    SpecialismNotFoundError,
)
from app.services.pathway.errors import PathwayNotFoundError
from app.services.practitioner_role.errors import PractitionerRoleNotFoundError


class ScopingService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── specialism master data ──────────────────────────────────────────

    async def list_specialisms(self, tenant_id: UUID) -> list[Specialism]:
        rows = await self._session.execute(
            select(Specialism)
            .where(Specialism.tenant_id == tenant_id, Specialism.deleted_at.is_(None))
            .order_by(Specialism.code)
        )
        return list(rows.scalars().all())

    async def create_specialism(
        self, current_user: SessionUser, *, code: str, display: str
    ) -> Specialism:
        existing = await self._session.scalar(
            select(Specialism.id).where(
                Specialism.tenant_id == current_user.tenant_id,
                Specialism.code == code,
                Specialism.deleted_at.is_(None),
            )
        )
        if existing is not None:
            raise SpecialismCodeTakenError()
        specialism = Specialism(code=code, display=display)
        self._session.add(specialism)
        await self._session.commit()
        await self._session.refresh(specialism)
        return specialism

    async def delete_specialism(self, current_user: SessionUser, specialism_id: UUID) -> None:
        specialism = await self._get_specialism(current_user.tenant_id, specialism_id)
        in_use = await self._session.scalar(
            select(PractitionerRoleSpecialism.id)
            .where(
                PractitionerRoleSpecialism.specialism_id == specialism_id,
                PractitionerRoleSpecialism.deleted_at.is_(None),
            )
            .limit(1)
        ) or await self._session.scalar(
            select(PathwaySpecialism.id)
            .where(
                PathwaySpecialism.specialism_id == specialism_id,
                PathwaySpecialism.deleted_at.is_(None),
            )
            .limit(1)
        )
        if in_use is not None:
            raise SpecialismInUseError()
        await self._session.delete(specialism)
        await self._session.commit()

    # ── practitioner-role links (REQ-FUN-28) ────────────────────────────

    async def list_role_specialisms(self, tenant_id: UUID, role_id: UUID) -> list[Specialism]:
        await self._get_role(tenant_id, role_id)
        rows = await self._session.execute(
            select(Specialism)
            .join(
                PractitionerRoleSpecialism,
                PractitionerRoleSpecialism.specialism_id == Specialism.id,
            )
            .where(
                PractitionerRoleSpecialism.practitioner_role_id == role_id,
                PractitionerRoleSpecialism.deleted_at.is_(None),
                Specialism.deleted_at.is_(None),
            )
            .order_by(Specialism.code)
        )
        return list(rows.scalars().all())

    async def set_role_specialisms(
        self, current_user: SessionUser, *, role_id: UUID, specialism_ids: list[UUID]
    ) -> list[Specialism]:
        await self._get_role(current_user.tenant_id, role_id)
        desired = set(specialism_ids)
        for sid in desired:
            await self._get_specialism(current_user.tenant_id, sid)
        existing = {
            link.specialism_id: link
            for link in (
                await self._session.execute(
                    select(PractitionerRoleSpecialism).where(
                        PractitionerRoleSpecialism.practitioner_role_id == role_id,
                        PractitionerRoleSpecialism.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        }
        for sid, link in existing.items():
            if sid not in desired:
                await self._session.delete(link)
        for sid in desired - existing.keys():
            self._session.add(
                PractitionerRoleSpecialism(practitioner_role_id=role_id, specialism_id=sid)
            )
        await self._session.commit()
        return await self.list_role_specialisms(current_user.tenant_id, role_id)

    # ── carepath links (REQ-NON-10/12) ──────────────────────────────────

    async def set_pathway_specialisms(
        self, current_user: SessionUser, *, pathway_id: UUID, specialism_ids: list[UUID]
    ) -> list[Specialism]:
        await self._get_pathway(current_user.tenant_id, pathway_id)
        desired = set(specialism_ids)
        for sid in desired:
            await self._get_specialism(current_user.tenant_id, sid)
        existing = {
            link.specialism_id: link
            for link in (
                await self._session.execute(
                    select(PathwaySpecialism).where(
                        PathwaySpecialism.pathway_id == pathway_id,
                        PathwaySpecialism.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        }
        for sid, link in existing.items():
            if sid not in desired:
                await self._session.delete(link)
        for sid in desired - existing.keys():
            self._session.add(PathwaySpecialism(pathway_id=pathway_id, specialism_id=sid))
        await self._session.commit()
        rows = await self._session.execute(
            select(Specialism)
            .join(PathwaySpecialism, PathwaySpecialism.specialism_id == Specialism.id)
            .where(
                PathwaySpecialism.pathway_id == pathway_id,
                PathwaySpecialism.deleted_at.is_(None),
            )
            .order_by(Specialism.code)
        )
        return list(rows.scalars().all())

    async def set_pathway_practitioners(
        self, current_user: SessionUser, *, pathway_id: UUID, user_ids: list[UUID]
    ) -> list[UUID]:
        await self._get_pathway(current_user.tenant_id, pathway_id)
        desired = set(user_ids)
        for uid in desired:
            user = await self._session.get(User, uid)
            if user is None or user.tenant_id != current_user.tenant_id or user.deleted_at:
                raise PathwayNotFoundError()  # existence-hiding for foreign users
        existing = {
            link.user_id: link
            for link in (
                await self._session.execute(
                    select(PathwayPractitioner).where(
                        PathwayPractitioner.pathway_id == pathway_id,
                        PathwayPractitioner.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        }
        for uid, link in existing.items():
            if uid not in desired:
                await self._session.delete(link)
        for uid in desired - existing.keys():
            self._session.add(PathwayPractitioner(pathway_id=pathway_id, user_id=uid))
        await self._session.commit()
        return sorted(desired)

    # ── lookups ─────────────────────────────────────────────────────────

    async def _get_specialism(self, tenant_id: UUID, specialism_id: UUID) -> Specialism:
        specialism = await self._session.get(Specialism, specialism_id)
        if specialism is None or specialism.tenant_id != tenant_id or specialism.deleted_at:
            raise SpecialismNotFoundError()
        return specialism

    async def _get_role(self, tenant_id: UUID, role_id: UUID) -> PractitionerRole:
        role = await self._session.get(PractitionerRole, role_id)
        if role is None or role.tenant_id != tenant_id or role.deleted_at:
            raise PractitionerRoleNotFoundError()
        return role

    async def _get_pathway(self, tenant_id: UUID, pathway_id: UUID) -> Pathway:
        pathway = await self._session.get(Pathway, pathway_id)
        if pathway is None or pathway.tenant_id != tenant_id or pathway.deleted_at:
            raise PathwayNotFoundError()
        return pathway
