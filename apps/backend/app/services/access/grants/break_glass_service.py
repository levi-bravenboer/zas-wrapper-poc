"""Break-glass grants (REQ-NON-8) — temporary, audited patient access.

Eligibility is deliberately wide (any active caregiver in the tenant —
vervanging / emergency is exactly the case where the normal relations are
absent); the controls are the mandatory verbatim reason, the duration cap,
admin oversight, and the audit trail. The grant row + its outbox row commit
in one transaction (the before_flush hook maps `AccessGrant` →
`Patient:<id>`), so the `Patient#break_glass` tuple appears within one relay
poll and disappears via the expiry sweep.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings
from app.db.models.access.access_grant import AccessGrant
from app.db.models.patient import Patient
from app.schemas.auth.auth import SessionUser
from app.services.access.grants.errors import (
    AccessGrantNotFoundError,
    BreakGlassDurationError,
    BreakGlassReasonRequiredError,
)
from app.services.patient.errors import PatientNotFoundError


class BreakGlassService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def create_grant(
        self,
        current_user: SessionUser,
        *,
        patient_id: UUID,
        reason: str,
        hours: int,
    ) -> AccessGrant:
        if not reason.strip():
            raise BreakGlassReasonRequiredError()
        if hours > self._settings.authz_break_glass_max_hours:
            raise BreakGlassDurationError()

        patient = await self._session.get(Patient, patient_id)
        if patient is None or patient.tenant_id != current_user.tenant_id or patient.deleted_at:
            raise PatientNotFoundError()

        grant = AccessGrant(
            patient_id=patient_id,
            user_id=current_user.id,
            reason=reason,
            expires_at=datetime.now(UTC) + timedelta(hours=hours),
        )
        self._session.add(grant)
        await self._session.commit()
        await self._session.refresh(grant)
        return grant

    async def list_grants(self, tenant_id: UUID, *, active_only: bool) -> list[AccessGrant]:
        query = (
            select(AccessGrant)
            .where(AccessGrant.tenant_id == tenant_id, AccessGrant.deleted_at.is_(None))
            .order_by(AccessGrant.created_at.desc())
        )
        if active_only:
            query = query.where(
                AccessGrant.revoked_at.is_(None),
                AccessGrant.expires_at > datetime.now(UTC),
            )
        return list((await self._session.execute(query)).scalars().all())

    async def revoke_grant(self, current_user: SessionUser, grant_id: UUID) -> AccessGrant:
        grant = await self._session.get(AccessGrant, grant_id)
        if grant is None or grant.tenant_id != current_user.tenant_id or grant.deleted_at:
            raise AccessGrantNotFoundError()
        if grant.revoked_at is None:
            grant.revoked_at = datetime.now(UTC)
            grant.revoked_by = current_user.id
            await self._session.commit()
            await self._session.refresh(grant)
        return grant
