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
from app.services.access.identity.deps import KRATOS_IDP
from app.services.access.identity.kratos_client import KratosClient, KratosSchemaId
from app.services.access.identity.password import PasswordHasher
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
        kratos: KratosClient,
    ) -> None:
        self._session = session
        self._repo = repo
        self._practitioner_service = practitioner_service
        self._password_hasher = password_hasher
        self._kratos = kratos

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
        updated = await self._repo.update(user)
        # Lifecycle propagates to Kratos: deactivation revokes every live
        # session (immediate server-side effect) and disables the identity
        # so it cannot start new login flows. Reactivation re-enables the
        # identity but never restores old sessions.
        if user.external_idp == KRATOS_IDP and user.external_subject is not None:
            await self._kratos.set_identity_state(
                identity_id=user.external_subject, active=is_active
            )
            if not is_active:
                await self._kratos.revoke_identity_sessions(identity_id=user.external_subject)
        return updated

    async def logout_all_sessions(self, actor: SessionUser, target_user_id: UUID) -> None:
        """Admin action: revoke every Kratos session for the target user."""

        user = await self.get(actor, target_user_id)
        if user.external_idp == KRATOS_IDP and user.external_subject is not None:
            await self._kratos.revoke_identity_sessions(identity_id=user.external_subject)

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

        placeholder_hash = self._password_hasher.hash(placeholder_password)
        # Kratos is the credential system of record: create the identity
        # first (placeholder hash — unusable for login since the random
        # secret is discarded), then persist the projection columns.
        schema_id: KratosSchemaId = "default" if payload.role == Role.ADMIN else "practitioner"
        # One human = one Kratos identity (REQ-NON-3): a second role row for
        # an existing email links to the existing identity instead of
        # importing a duplicate (Kratos enforces email uniqueness anyway).
        identity = await self._kratos.find_identity_by_email(email=payload.email)
        if identity is None:
            identity = await self._kratos.import_identity(
                schema_id=schema_id,
                email=payload.email,
                hashed_password=placeholder_hash,
            )

        user = User(
            tenant_id=actor.tenant_id,
            email=payload.email,
            display_name=display_name,
            role=payload.role,
            is_active=True,
            password_hash=placeholder_hash,
            external_idp=KRATOS_IDP,
            external_subject=identity.id,
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
