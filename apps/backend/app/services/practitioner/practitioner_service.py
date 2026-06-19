from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.practitioner import Practitioner
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from app.schemas.practitioner.practitioner import PractitionerCreate, PractitionerUpdate
from app.services.access.rbac.guard import ADMIN_ROLE_SLUG
from app.services.access.rbac.resolver import load_role_context
from app.services.practitioner.errors import (
    CrossTenantPractitionerError,
    PractitionerAlreadyExistsError,
    PractitionerNotFoundError,
    UserNotCaregiverError,
)
from app.services.user.errors import UserNotFoundError


class PractitionerService:
    """Tenant-scoped CRUD for `Practitioner` rows.

    A `Practitioner` is the clinical-identity counterpart of a caregiver
    `User`. The 1:1 link is enforced via a unique FK on `user_id`. Only
    users with `role=caregiver` may have a Practitioner row — admins
    handle people, not patients.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_user_id(self, actor: SessionUser, user_id: UUID) -> Practitioner:
        result = await self._session.execute(
            select(Practitioner)
            .where(Practitioner.user_id == user_id, Practitioner.deleted_at.is_(None))
            .options(selectinload(Practitioner.roles))
        )
        practitioner = result.scalar_one_or_none()
        if practitioner is None:
            raise PractitionerNotFoundError()
        if practitioner.tenant_id != actor.tenant_id:
            raise CrossTenantPractitionerError()
        return practitioner

    async def create(self, actor: SessionUser, payload: PractitionerCreate) -> Practitioner:
        user = await self._load_user(payload.user_id)
        if user.tenant_id != actor.tenant_id:
            raise CrossTenantPractitionerError()
        # Caregiver identity = having a Practitioner row. Exclude the other
        # identity-types: admin-role users and patients may not have one.
        role_slug, _ = await load_role_context(self._session, user.role_id)
        if role_slug == ADMIN_ROLE_SLUG or user.patient_id is not None:
            raise UserNotCaregiverError()
        existing = await self._session.execute(
            select(Practitioner.id).where(Practitioner.user_id == payload.user_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise PractitionerAlreadyExistsError()
        practitioner = Practitioner(
            user_id=payload.user_id,
            tenant_id=actor.tenant_id,
            family_name=payload.family_name,
            given_name=payload.given_name,
            qualification=payload.qualification,
        )
        self._session.add(practitioner)
        await self._session.flush()
        refreshed = await self._session.execute(
            select(Practitioner)
            .where(Practitioner.id == practitioner.id)
            .options(selectinload(Practitioner.roles))
        )
        return refreshed.scalar_one()

    async def update(
        self, actor: SessionUser, user_id: UUID, payload: PractitionerUpdate
    ) -> Practitioner:
        practitioner = await self.get_by_user_id(actor, user_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(practitioner, field, value)
        await self._session.flush()
        return practitioner

    async def assert_in_tenant(self, tenant_id: UUID, practitioner_id: UUID) -> None:
        result = await self._session.execute(
            select(Practitioner).where(
                Practitioner.id == practitioner_id,
                Practitioner.deleted_at.is_(None),
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise PractitionerNotFoundError()
        if row.tenant_id != tenant_id:
            raise CrossTenantPractitionerError()

    async def _load_user(self, user_id: UUID) -> User:
        result = await self._session.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise UserNotFoundError()
        return user
