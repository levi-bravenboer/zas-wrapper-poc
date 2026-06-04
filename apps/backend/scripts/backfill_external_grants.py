"""One-shot backfill: legacy `Patient#external_carer` tuples → domain rows.

`access-entitlements` retires the externally-managed `external_carer`
relation: external access gains a domain source (`external_grants` +
`consents`, verb-gated by `external_access_profiles`). The reconciler now
treats `external_carer` tuples as orphans — so this script MUST run before
the first reconcile after the upgrade, converting each legacy tuple into:

- an active `Consent` (scope `external_collaboration`) for the patient,
- an `ExternalGrant` (professional type `other`) referencing it,
- an `ExternalAccessProfile` for type `other` (read-only) if missing —
  preserving exactly the old semantics: view, never view_shielded.

Idempotent: a user×patient pair that already has an open grant is skipped.

Run: `python -m scripts.backfill_external_grants` (then
`python -m scripts.reconcile_authz_tuples`).
"""

from __future__ import annotations

import logging
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.practitioner_role import PractitionerRoleCode
from app.core.enums.user import Role
from app.core.settings import get_settings
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.access.consent import Consent
from app.db.models.access.external_access import ExternalAccessProfile, ExternalGrant
from app.db.models.patient.patient import Patient
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from app.services.access.permissions.keto_client import KetoClient
from scripts._db import run_script

logger = logging.getLogger(__name__)

_SCOPE = "external_collaboration"
_LEGACY_TYPE = PractitionerRoleCode.OTHER


async def _admin_actor(session: AsyncSession) -> SessionUser:
    admin = (
        (
            await session.execute(
                select(User).where(User.role == Role.ADMIN, User.deleted_at.is_(None)).limit(1)
            )
        )
        .scalars()
        .one()
    )
    return SessionUser(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        tenant_id=admin.tenant_id,
        role=admin.role,
    )


async def _ensure_profile(session: AsyncSession, tenant_id: UUID) -> None:
    existing = await session.execute(
        select(ExternalAccessProfile).where(
            ExternalAccessProfile.tenant_id == tenant_id,
            ExternalAccessProfile.professional_type == _LEGACY_TYPE,
            ExternalAccessProfile.deleted_at.is_(None),
        )
    )
    if existing.scalars().first() is None:
        # read-only: exactly the legacy external_carer semantics
        session.add(ExternalAccessProfile(professional_type=_LEGACY_TYPE, allow_read=True))


async def _run(session: AsyncSession) -> None:
    session.info[SESSION_ACTOR_KEY] = await _admin_actor(session)

    async with httpx.AsyncClient(timeout=10.0) as http:
        keto = KetoClient(get_settings(), http)
        legacy = await keto.query_tuples(namespace="Patient", relation="external_carer")

    if not legacy:
        logger.info("no legacy external_carer tuples found; nothing to backfill")
        return

    converted = skipped = 0
    for relation_tuple in legacy:
        if relation_tuple.subject_id is None or not relation_tuple.subject_id.startswith("User:"):
            logger.warning("skipping non-user subject tuple: %s", relation_tuple)
            skipped += 1
            continue
        try:
            user_id = UUID(relation_tuple.subject_id.removeprefix("User:"))
            patient_id = UUID(relation_tuple.object_id)
        except ValueError:
            # smoke-test residue (e.g. Patient:p-1) — not domain data
            logger.warning("skipping non-UUID tuple: %s", relation_tuple)
            skipped += 1
            continue

        patient = await session.get(Patient, patient_id)
        if patient is None:
            logger.warning("skipping tuple for unknown patient %s", patient_id)
            skipped += 1
            continue

        open_grant = await session.execute(
            select(ExternalGrant).where(
                ExternalGrant.patient_id == patient_id,
                ExternalGrant.user_id == user_id,
                ExternalGrant.period_end.is_(None),
                ExternalGrant.deleted_at.is_(None),
            )
        )
        if open_grant.scalars().first() is not None:
            skipped += 1
            continue

        await _ensure_profile(session, patient.tenant_id)
        consent = Consent(patient_id=patient_id, scope=_SCOPE)
        session.add(consent)
        await session.flush()  # consent.id for the FK
        session.add(
            ExternalGrant(
                patient_id=patient_id,
                user_id=user_id,
                professional_type=_LEGACY_TYPE,
                consent_id=consent.id,
            )
        )
        converted += 1

    logger.info(
        "external_carer backfill: %d tuples converted to grants, %d skipped",
        converted,
        skipped,
    )


def main() -> None:
    run_script(_run)


if __name__ == "__main__":
    main()
