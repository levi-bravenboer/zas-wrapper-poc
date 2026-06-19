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
from uuid import UUID, uuid5

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.user import User
from app.repositories.tenant import TenantRepository
from app.repositories.user.user_repository import UserRepository
from app.services.access.identity.password import PasswordHasher
from app.services.access.rbac.resolver import build_session_user
from scripts._db import run_script
from scripts.seed_roles import (
    ADMIN_ROLE_SLUG,
    DEFAULT_ROLE_SLUG,
    bootstrap_admin_role,
    seed_roles,
)
from scripts.seed_tenant import ZAS_TENANT_SLUG

logger = logging.getLogger(__name__)

ADMIN_USER_ID: UUID = UUID("00000000-0000-4000-8000-00000000ad11")

# Stable namespace so the bootstrap admin role's id is known before its row is
# flushed (the admin user references it via `role_id`).
_ROLE_ID_NS: UUID = UUID("00000000-0000-4000-8000-0000000000fe")


def admin_role_id(tenant_id: UUID) -> UUID:
    """Deterministic id of the per-tenant `admin` role."""

    return uuid5(_ROLE_ID_NS, f"{tenant_id}:{ADMIN_ROLE_SLUG}")


ADMIN_EMAIL = "admin@zas.local"
ADMIN_DISPLAY_NAME = "ZAS Admin"
ADMIN_PASSWORD_ENV = "BACKEND_BOOTSTRAP_ADMIN_PASSWORD"

CAREGIVER_EMAIL = "caregiver@zas.local"
CAREGIVER_DISPLAY_NAME = "Demo Caregiver"
CAREGIVER_PASSWORD_ENV = "BACKEND_BOOTSTRAP_CAREGIVER_PASSWORD"

# Demo clinical cast (§6c.2): specialty caregivers the enroll-time participant
# picker resolves against. `(email, display_name, specialty)`; their
# `PractitionerRole` (code + specialty) is seeded by `seed_practitioners`.
CLINICAL_CAST: tuple[tuple[str, str, str], ...] = (
    ("uroloog@zas.local", "Dr. Uroloog", "urologie"),
    ("radioloog@zas.local", "Dr. Radioloog", "radiologie"),
    ("patholoog@zas.local", "Dr. Patholoog", "pathologie"),
    ("oncoloog@zas.local", "Dr. Oncoloog", "oncologie"),
    ("casemanager@zas.local", "Verpleegkundig Casemanager", "casemanagement"),
)

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
    bootstrap_admin_role_id = admin_role_id(tenant.id)

    # 1. Bootstrap the `admin` ROLE first (roles carry no user FKs, so no
    # cycle), then the bootstrap admin USER, which self-references its audit
    # columns (id = created_by = updated_by = ADMIN_USER_ID) and points at the
    # admin role via `role_id`.
    previous_actor = session.info.pop(SESSION_ACTOR_KEY, None)
    try:
        await bootstrap_admin_role(session, role_id=bootstrap_admin_role_id, tenant_id=tenant.id)
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
                role_id=bootstrap_admin_role_id,
                is_active=True,
            )
            await user_repo.add(admin)
            logger.info("seeded user email=%s role=%s", ADMIN_EMAIL, ADMIN_ROLE_SLUG)
        else:
            logger.info("user email=%s already present", ADMIN_EMAIL)

        # Admin actor (resolved role slug + permissions) for the audit hook.
        admin_actor = await build_session_user(session, admin)

        # 2. Seed the `default` role (+ permissions) and the demo caregivers,
        # all under the admin actor so the audit hook stamps their columns.
        session.info[SESSION_ACTOR_KEY] = admin_actor
        roles = await seed_roles(session, tenant_id=tenant.id)
        default_role = roles[DEFAULT_ROLE_SLUG]

        caregiver = await user_repo.get_by_email(tenant.id, CAREGIVER_EMAIL)
        if caregiver is None:
            caregiver = User(
                email=CAREGIVER_EMAIL,
                password_hash=_resolve_password(CAREGIVER_PASSWORD_ENV, hasher),
                display_name=CAREGIVER_DISPLAY_NAME,
                role_id=default_role.id,
                is_active=True,
            )
            await user_repo.add(caregiver)
            logger.info("seeded user email=%s role=%s", CAREGIVER_EMAIL, DEFAULT_ROLE_SLUG)
        else:
            logger.info("user email=%s already present", CAREGIVER_EMAIL)

        # Specialty cast (§6c.2) — caregivers (default role) for the picker.
        cast_password = _resolve_password(CAREGIVER_PASSWORD_ENV, hasher)
        for email, display_name, _specialty in CLINICAL_CAST:
            if await user_repo.get_by_email(tenant.id, email) is not None:
                logger.info("user email=%s already present", email)
                continue
            await user_repo.add(
                User(
                    email=email,
                    password_hash=cast_password,
                    display_name=display_name,
                    role_id=default_role.id,
                    is_active=True,
                )
            )
            logger.info("seeded user email=%s role=%s", email, DEFAULT_ROLE_SLUG)
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
