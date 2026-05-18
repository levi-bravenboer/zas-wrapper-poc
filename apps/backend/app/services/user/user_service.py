from __future__ import annotations

import secrets
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.user import User
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.practitioner.practitioner import PractitionerCreate
from app.schemas.user.user import UserCreate, UserUpdate
from app.services.auth.password import PasswordHasher
from app.services.practitioner.practitioner_service import PractitionerService
from app.services.user.errors import (
    CrossTenantAccessError,
    EmailAlreadyExistsError,
    UserNotFoundError,
)


class UserService:
    """Tenant-scoped admin CRUD over `User`.

    Caregiver creation atomically materialises the linked `Practitioner` row
    in the same SQLAlchemy unit-of-work — both inserts are flushed together so
    a Practitioner failure rolls back the User insert via the surrounding
    request transaction.
    """

    def __init__(
        self,
        session: AsyncSession,
        repo: UserRepository,
        practitioner_service: PractitionerService,
        password_hasher: PasswordHasher,
    ) -> None:
        self._session = session
        self._repo = repo
        self._practitioner_service = practitioner_service
        self._password_hasher = password_hasher

    async def get(self, actor: SessionUser, target_user_id: UUID) -> User:
        user = await self._repo.get_by_id(target_user_id)
        if user is None:
            raise UserNotFoundError()
        if user.tenant_id != actor.tenant_id:
            raise CrossTenantAccessError()
        return user

    async def assign_role(self, actor: SessionUser, target_user_id: UUID, role: Role) -> User:
        user = await self.get(actor, target_user_id)
        user.role = role
        return await self._repo.update(user)

    async def set_active(
        self, actor: SessionUser, target_user_id: UUID, *, is_active: bool
    ) -> User:
        user = await self.get(actor, target_user_id)
        user.is_active = is_active
        return await self._repo.update(user)

    async def create(self, actor: SessionUser, payload: UserCreate) -> User:
        existing = await self._repo.get_by_email(actor.tenant_id, payload.email)
        if existing is not None:
            raise EmailAlreadyExistsError()

        if payload.role == Role.ADMIN:
            # Validator guarantees display_name presence for the admin branch.
            assert payload.display_name is not None
            display_name = payload.display_name.strip()
        else:
            assert payload.given_name is not None and payload.family_name is not None
            display_name = f"{payload.given_name.strip()} {payload.family_name.strip()}"

        # Placeholder credential — admin onboards real auth via separate flow.
        # Random URL-safe token hashed with the standard hasher means the row
        # satisfies the `ck_users_credential_present` CHECK constraint without
        # being usable for login.
        placeholder_password = secrets.token_urlsafe(32)

        user = User(
            tenant_id=actor.tenant_id,
            email=payload.email,
            display_name=display_name,
            role=payload.role,
            is_active=True,
            password_hash=self._password_hasher.hash(placeholder_password),
        )
        self._session.add(user)
        await self._session.flush()

        if payload.role == Role.CAREGIVER:
            assert payload.given_name is not None and payload.family_name is not None
            await self._practitioner_service.create(
                actor,
                PractitionerCreate(
                    user_id=user.id,
                    given_name=payload.given_name.strip(),
                    family_name=payload.family_name.strip(),
                    qualification=(
                        payload.qualification.strip()
                        if payload.qualification and payload.qualification.strip()
                        else None
                    ),
                ),
            )

        return user

    async def update_demographics(
        self, actor: SessionUser, target_user_id: UUID, payload: UserUpdate
    ) -> User:
        user = await self.get(actor, target_user_id)
        if payload.display_name is not None:
            stripped = payload.display_name.strip()
            if stripped:
                user.display_name = stripped
        return await self._repo.update(user)
