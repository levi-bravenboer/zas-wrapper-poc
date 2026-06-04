"""External collaboration management (REQ-FUN-1/42).

Profiles bound what each professional type MAY do; grants give one external
user consent-backed access to one patient. Tuple derivation evaluates
profile ∩ open grant ∩ active consent — every mutation here flows through
the ORM so the outbox enqueues the affected patient in the same transaction
(consent revocation therefore drops the verb tuples within one relay poll).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.access import ConsentStatus
from app.core.enums.practitioner_role import PractitionerRoleCode
from app.db.models.access.consent import Consent
from app.db.models.access.external_access import ExternalAccessProfile, ExternalGrant
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from app.services.access.grants.errors import (
    ConsentNotActiveError,
    ConsentNotFoundError,
    ExternalGrantNotFoundError,
)
from app.services.patient.errors import PatientNotFoundError


class ExternalAccessService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── profiles (per professional type) ────────────────────────────────

    async def list_profiles(self, tenant_id: UUID) -> list[ExternalAccessProfile]:
        rows = await self._session.execute(
            select(ExternalAccessProfile)
            .where(
                ExternalAccessProfile.tenant_id == tenant_id,
                ExternalAccessProfile.deleted_at.is_(None),
            )
            .order_by(ExternalAccessProfile.professional_type)
        )
        return list(rows.scalars().all())

    async def upsert_profile(
        self,
        current_user: SessionUser,
        *,
        professional_type: PractitionerRoleCode,
        allow_read: bool,
        allow_write: bool,
        allow_record: bool,
        allow_message: bool,
    ) -> ExternalAccessProfile:
        profile = (
            await self._session.execute(
                select(ExternalAccessProfile).where(
                    ExternalAccessProfile.tenant_id == current_user.tenant_id,
                    ExternalAccessProfile.professional_type == professional_type,
                    ExternalAccessProfile.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if profile is None:
            profile = ExternalAccessProfile(professional_type=professional_type)
            self._session.add(profile)
        profile.allow_read = allow_read
        profile.allow_write = allow_write
        profile.allow_record = allow_record
        profile.allow_message = allow_message
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    # ── consents (minimal record; full IC flow is BL-017) ───────────────

    async def create_consent(
        self, current_user: SessionUser, *, patient_id: UUID, scope: str
    ) -> Consent:
        consent = Consent(patient_id=patient_id, scope=scope)
        self._session.add(consent)
        await self._session.commit()
        await self._session.refresh(consent)
        return consent

    async def revoke_consent(self, current_user: SessionUser, consent_id: UUID) -> Consent:
        consent = await self._session.get(Consent, consent_id)
        if consent is None or consent.tenant_id != current_user.tenant_id or consent.deleted_at:
            raise ConsentNotFoundError()
        if consent.status is not ConsentStatus.REVOKED:
            consent.status = ConsentStatus.REVOKED
            consent.revoked_at = datetime.now(UTC)
            await self._session.commit()
            await self._session.refresh(consent)
        return consent

    # ── grants ──────────────────────────────────────────────────────────

    async def create_grant(
        self,
        current_user: SessionUser,
        *,
        patient_id: UUID,
        user_id: UUID,
        professional_type: PractitionerRoleCode,
        consent_id: UUID,
    ) -> ExternalGrant:
        consent = await self._session.get(Consent, consent_id)
        if (
            consent is None
            or consent.tenant_id != current_user.tenant_id
            or consent.patient_id != patient_id
            or consent.deleted_at
        ):
            raise ConsentNotFoundError()
        if consent.status is not ConsentStatus.ACTIVE:
            raise ConsentNotActiveError()
        user = await self._session.get(User, user_id)
        if user is None or user.tenant_id != current_user.tenant_id or user.deleted_at:
            raise PatientNotFoundError()  # existence-hiding for foreign users

        grant = ExternalGrant(
            patient_id=patient_id,
            user_id=user_id,
            professional_type=professional_type,
            consent_id=consent_id,
        )
        self._session.add(grant)
        await self._session.commit()
        await self._session.refresh(grant)
        return grant

    async def end_grant(self, current_user: SessionUser, grant_id: UUID) -> ExternalGrant:
        grant = await self._session.get(ExternalGrant, grant_id)
        if grant is None or grant.tenant_id != current_user.tenant_id or grant.deleted_at:
            raise ExternalGrantNotFoundError()
        if grant.period_end is None:
            grant.period_end = datetime.now(UTC)
            await self._session.commit()
            await self._session.refresh(grant)
        return grant

    async def list_grants(self, tenant_id: UUID, *, patient_id: UUID) -> list[ExternalGrant]:
        rows = await self._session.execute(
            select(ExternalGrant)
            .where(
                ExternalGrant.tenant_id == tenant_id,
                ExternalGrant.patient_id == patient_id,
                ExternalGrant.deleted_at.is_(None),
            )
            .order_by(ExternalGrant.created_at.desc())
        )
        return list(rows.scalars().all())
