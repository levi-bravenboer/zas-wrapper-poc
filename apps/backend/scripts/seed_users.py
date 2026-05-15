# POC ONLY — bootstrap seed; replace before non-PoC deployment.
#
# Inserts a bootstrap admin and a demo caregiver under the `zas` tenant.
# Passwords come from `BACKEND_BOOTSTRAP_ADMIN_PASSWORD` /
# `BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD`, falling back to `"changeme"` when
# unset (with a WARNING log line). The admin row breaks the self-FK cycle
# by setting `id = created_by = updated_by = ADMIN_USER_ID` explicitly; the
# audit hook skips fields that are already non-`None`. The caregiver row
# is flushed AFTER `session.info[SESSION_ACTOR_KEY] = admin_actor` so the
# hook auto-stamps its `tenant_id` / `created_by` / `updated_by`.

"""Idempotent seed of bootstrap admin + demo caregiver under the `zas` tenant.

Run: `python -m scripts.seed_users` (or `python scripts/seed_users.py`).
"""

from __future__ import annotations

import logging
import os
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.core.settings import get_settings
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.user import User
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.schemas.auth.auth import SessionUser
from app.services.auth.password import PasswordHasher
from scripts._db import run_script
from scripts.seed_tenant import ZAS_TENANT_SLUG

logger = logging.getLogger(__name__)

ADMIN_USER_ID: UUID = UUID("00000000-0000-4000-8000-00000000ad11")

ADMIN_EMAIL = "admin@zas.local"
ADMIN_DISPLAY_NAME = "ZAS Admin"
ADMIN_PASSWORD_ENV = "BACKEND_BOOTSTRAP_ADMIN_PASSWORD"

CAREGIVER_EMAIL = "caregiver@zas.local"
CAREGIVER_DISPLAY_NAME = "Demo Caregiver"
CAREGIVER_PASSWORD_ENV = "BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD"

_PASSWORD_FALLBACK = "changeme"


def _guard_production_bootstrap() -> None:
    """Refuse to run in production unless explicit bootstrap passwords are set.

    Analogous to the session-secret guard: the `"changeme"` fallback is a
    PoC convenience, never acceptable in prod. Caller MUST set both
    `BACKEND_BOOTSTRAP_*_PASSWORD` env vars before invoking the seed.
    """

    if get_settings().env != "production":
        return
    for env_var in (ADMIN_PASSWORD_ENV, CAREGIVER_PASSWORD_ENV):
        if os.getenv(env_var) is None:
            raise RuntimeError(
                f"refusing to seed in production: {env_var} is unset; "
                f"the {_PASSWORD_FALLBACK!r} fallback is PoC-only"
            )


def _resolve_password(env_var: str, hasher: PasswordHasher) -> str:
    raw = os.getenv(env_var)
    if raw is None:
        logger.warning(
            "bootstrap password env var %s unset, using %r fallback",
            env_var,
            _PASSWORD_FALLBACK,
        )
        raw = _PASSWORD_FALLBACK
    return hasher.hash(raw)


class _ZasTenantMissingError(RuntimeError):
    """Raised when `seed_users` runs before the `zas` tenant exists."""


async def seed_users(session: AsyncSession) -> list[User]:
    _guard_production_bootstrap()
    tenant_repo = TenantRepository(session)
    tenant = await tenant_repo.get_by_slug(ZAS_TENANT_SLUG)
    if tenant is None:
        logger.error(
            "cannot seed users: %s tenant missing — run seed_tenant first",
            ZAS_TENANT_SLUG,
        )
        raise _ZasTenantMissingError(f"{ZAS_TENANT_SLUG} tenant missing — run seed_tenant first")

    hasher = PasswordHasher()
    user_repo = UserRepository(session)

    # 1. Admin first. The audit hook MUST stay idle for this flush so the
    # self-FK survives; clear the slot before inserting.
    previous_actor = session.info.pop(SESSION_ACTOR_KEY, None)
    try:
        admin = await user_repo.get_by_email(tenant.id, ADMIN_EMAIL)
        if admin is None:
            admin = User(
                id=ADMIN_USER_ID,
                tenant_id=tenant.id,
                created_by=ADMIN_USER_ID,
                updated_by=ADMIN_USER_ID,
                email=ADMIN_EMAIL,
                password_hash=_resolve_password(ADMIN_PASSWORD_ENV, hasher),
                display_name=ADMIN_DISPLAY_NAME,
                role=Role.ADMIN,
                is_active=True,
            )
            await user_repo.add(admin)
            logger.info("seeded user email=%s role=%s", ADMIN_EMAIL, Role.ADMIN.value)
        else:
            logger.info("user email=%s already present", ADMIN_EMAIL)

        admin_actor = SessionUser(
            id=admin.id,
            email=admin.email,
            display_name=admin.display_name,
            tenant_id=admin.tenant_id,
            role=admin.role,
        )

        # 2. Caregiver second — audit hook stamps the audit columns from the
        # admin actor; do NOT set them explicitly.
        session.info[SESSION_ACTOR_KEY] = admin_actor
        caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
        if caregiver is None:
            caregiver = User(
                email=CAREGIVER_EMAIL,
                password_hash=_resolve_password(CAREGIVER_PASSWORD_ENV, hasher),
                display_name=CAREGIVER_DISPLAY_NAME,
                role=Role.CAREGIVER,
                is_active=True,
            )
            await user_repo.add(caregiver)
            logger.info("seeded user email=%s role=%s", CAREGIVER_EMAIL, Role.CAREGIVER.value)
        else:
            logger.info("user email=%s already present", CAREGIVER_EMAIL)
    finally:
        if previous_actor is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous_actor

    return [admin, caregiver]


async def _seed(session: AsyncSession) -> None:
    await seed_users(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
