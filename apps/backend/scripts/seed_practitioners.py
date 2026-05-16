# SYNTHETIC ONLY — see openspec/project.md no-PHI invariant.
#
# Bridges seeded caregiver `User` rows to FHIR `Practitioner` +
# `PractitionerRole` rows. The demo caregiver is anchored to the
# Rugrevalidatie team org (same org that holds the demo patients) so the
# visibility predicate (`practitioner_root_orgs_for`) resolves to the
# ZAS root and the caregiver can see every demo patient even without an
# explicit care-team membership.
#
# Idempotency:
#   - Practitioner: lookup by `(tenant_id, user_id)`.
#   - PractitionerRole: lookup by
#     `(practitioner_id, organisation_id, period_end IS NULL)` — mirrors
#     the partial unique index `uq_practitioner_roles_open_affiliation`.

"""Idempotent seed of Practitioner + primary PractitionerRole per caregiver."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.practitioner_role import PractitionerRoleCode
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.user import User
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from scripts._db import run_script
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

logger = logging.getLogger(__name__)


class _ZasTenantMissingError(RuntimeError):
    """Raised when `seed_practitioners` runs before the `zas` tenant exists."""


class _SeedUserMissingError(RuntimeError):
    """Raised when `seed_practitioners` runs before admin/caregiver exist."""


def _split_display_name(display_name: str) -> tuple[str, str]:
    """Best-effort split of `display_name` into (given, family).

    Single-token names become `(given="", family=<token>)`. This mirrors
    the migration-time backfill so seed runs against an empty DB match
    re-runs against a migrated DB.
    """

    parts = display_name.strip().split(" ", 1)
    if len(parts) == 1:
        return "", parts[0]
    return parts[0], parts[1]


async def seed_practitioners(session: AsyncSession) -> list[Practitioner]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        raise _ZasTenantMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    user_repo = UserRepository(session)
    admin = await user_repo.get_by_email(tenant.id, ADMIN_EMAIL)
    caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
    if admin is None or caregiver is None:
        raise _SeedUserMissingError("admin/caregiver missing — run seed_users first")

    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        tenant_id=admin.tenant_id,
        role=admin.role,
    )
    try:
        practitioner = await _get_or_create_practitioner(
            session, tenant_id=tenant.id, user=caregiver
        )
        await _get_or_create_open_primary_role(
            session,
            tenant_id=tenant.id,
            practitioner_id=practitioner.id,
            organisation_id=RUGREVAL_TEAM_ORG_ID,
        )
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return [practitioner]


async def _get_or_create_practitioner(
    session: AsyncSession, *, tenant_id, user: User
) -> Practitioner:
    existing = (
        await session.execute(
            select(Practitioner).where(
                Practitioner.tenant_id == tenant_id,
                Practitioner.user_id == user.id,
                Practitioner.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("practitioner for user_id=%s already present", user.id)
        return existing

    given, family = _split_display_name(user.display_name)
    practitioner = Practitioner(
        tenant_id=tenant_id,
        user_id=user.id,
        given_name=given,
        family_name=family,
    )
    session.add(practitioner)
    await session.flush()
    logger.info("seeded practitioner for user_id=%s", user.id)
    return practitioner


async def _get_or_create_open_primary_role(
    session: AsyncSession,
    *,
    tenant_id,
    practitioner_id,
    organisation_id,
) -> PractitionerRole:
    existing = (
        await session.execute(
            select(PractitionerRole).where(
                PractitionerRole.practitioner_id == practitioner_id,
                PractitionerRole.organisation_id == organisation_id,
                PractitionerRole.period_end.is_(None),
                PractitionerRole.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info(
            "open practitioner role for practitioner_id=%s org_id=%s already present",
            practitioner_id,
            organisation_id,
        )
        return existing

    row = PractitionerRole(
        tenant_id=tenant_id,
        practitioner_id=practitioner_id,
        organisation_id=organisation_id,
        code=PractitionerRoleCode.OTHER,
        is_primary=True,
    )
    session.add(row)
    await session.flush()
    logger.info(
        "seeded open practitioner role for practitioner_id=%s org_id=%s",
        practitioner_id,
        organisation_id,
    )
    return row


async def _seed(session: AsyncSession) -> None:
    await seed_practitioners(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
