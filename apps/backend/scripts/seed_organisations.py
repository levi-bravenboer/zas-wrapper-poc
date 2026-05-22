# POC ONLY — demo organisation tree; replace before non-PoC deployment.
#
# Seeds the demo 3-level organisation tree under the `zas` tenant:
#   prov (root)  → ZAS Antwerpen
#     dept       → Orthopedie
#       team     → Rugrevalidatie
#
# Stable UUIDs let downstream seeds (patients, care-teams) FK to a known
# tree without lookups. Idempotent by `(tenant_id, name,
# parent_organisation_id)` lookup. The audit hook stamps `created_by` /
# `updated_by` from `session.info[SESSION_ACTOR_KEY]`; this script populates
# the slot with the bootstrap admin actor before inserting org rows. The
# bootstrap admin must already exist — `seed_all` runs users BEFORE
# organisations because `organisations.created_by` FKs `users.id`.

"""Idempotent seed of the demo organisation tree under the `zas` tenant.

Run: `python -m scripts.seed_organisations` (or `python scripts/seed_organisations.py`).
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.organisation import ORGANISATION_TYPE_SYSTEM, OrganisationTypeCode
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.organisation import Organisation
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from scripts._db import run_script
from scripts.seed_tenant import ZAS_TENANT_SLUG
from scripts.seed_users import ADMIN_USER_ID

logger = logging.getLogger(__name__)

ZAS_ROOT_ORG_ID: UUID = UUID("00000000-0000-4000-8000-00000000016a")
ORTHO_DEPT_ORG_ID: UUID = UUID("00000000-0000-4000-8000-00000000016b")
RUGREVAL_TEAM_ORG_ID: UUID = UUID("00000000-0000-4000-8000-00000000016c")


class _ZasTenantMissingError(RuntimeError):
    """Raised when `seed_organisations` runs before the `zas` tenant exists."""


class _BootstrapAdminMissingError(RuntimeError):
    """Raised when `seed_organisations` runs before the bootstrap admin exists."""


async def _get_or_create(
    session: AsyncSession,
    *,
    org_id: UUID,
    tenant_id: UUID,
    name: str,
    type_code: OrganisationTypeCode,
    type_display: str,
    parent_organisation_id: UUID | None,
) -> Organisation:
    existing = await session.get(Organisation, org_id)
    if existing is not None:
        logger.info("organisation name=%s already present", name)
        return existing

    # Audit columns (`created_by` / `updated_by`) and `tenant_id` are stamped
    # by the `before_flush` audit hook from `session.info[SESSION_ACTOR_KEY]`,
    # set by the caller to the bootstrap admin actor before this is called.
    org = Organisation(
        id=org_id,
        tenant_id=tenant_id,
        name=name,
        type_code=type_code.value,
        type_system=ORGANISATION_TYPE_SYSTEM,
        type_display=type_display,
        parent_organisation_id=parent_organisation_id,
    )
    session.add(org)
    await session.flush()
    logger.info("seeded organisation name=%s type=%s", name, type_code.value)
    return org


async def seed_organisations(session: AsyncSession) -> list[Organisation]:
    tenant = await TenantRepository(session).get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        logger.error(
            "cannot seed organisations: %s tenant missing — run seed_tenant first",
            ZAS_TENANT_SLUG,
        )
        raise _ZasTenantMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    # Bootstrap admin must exist so AuditableEntity FKs (created_by / updated_by)
    # resolve. seed_all runs users BEFORE organisations for this reason.
    user_repo = UserRepository(session)
    admin = await user_repo.get_by_id(ADMIN_USER_ID)
    if admin is None:
        logger.error("cannot seed organisations: bootstrap admin missing — run seed_users first")
        raise _BootstrapAdminMissingError("bootstrap admin missing — run seed_users first")

    previous_actor = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = SessionUser(
        id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        tenant_id=admin.tenant_id,
        role=admin.role,
    )
    try:
        root = await _get_or_create(
            session,
            org_id=ZAS_ROOT_ORG_ID,
            tenant_id=tenant.id,
            name="ZAS Antwerpen",
            type_code=OrganisationTypeCode.PROVIDER,
            type_display="Healthcare Provider",
            parent_organisation_id=None,
        )
        dept = await _get_or_create(
            session,
            org_id=ORTHO_DEPT_ORG_ID,
            tenant_id=tenant.id,
            name="Orthopedie",
            type_code=OrganisationTypeCode.DEPARTMENT,
            type_display="Hospital Department",
            parent_organisation_id=root.id,
        )
        team = await _get_or_create(
            session,
            org_id=RUGREVAL_TEAM_ORG_ID,
            tenant_id=tenant.id,
            name="Rugrevalidatie",
            type_code=OrganisationTypeCode.TEAM,
            type_display="Organizational team",
            parent_organisation_id=dept.id,
        )
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return [root, dept, team]


async def _seed(session: AsyncSession) -> None:
    await seed_organisations(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
