"""Import every active local user into Ory Kratos — the authn cutover step.

For each non-deleted `users` row with a `password_hash` and no Kratos link
yet, create a Kratos identity carrying the argon2id hash verbatim (no
password resets) and write back `external_idp='kratos'` +
`external_subject=<identity.id>`.

Idempotent: rows already linked are skipped; identities that exist in
Kratos under the same email (from a previous partial run) are re-linked
instead of duplicated.

Run: `python -m scripts.import_identities_kratos`.
"""

from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.core.settings import get_settings
from app.db.models.user import User
from app.services.access.identity.kratos_client import KratosClient, KratosSchemaId
from scripts._db import run_script

logger = logging.getLogger(__name__)

KRATOS_IDP = "kratos"

_SCHEMA_BY_ROLE: dict[Role, KratosSchemaId] = {
    Role.ADMIN: "default",
    Role.CAREGIVER: "practitioner",
    Role.PATIENT: "patient",
}


async def import_identities(session: AsyncSession, kratos: KratosClient) -> tuple[int, int]:
    """Returns (imported, skipped) counts."""

    result = await session.execute(select(User).where(User.deleted_at.is_(None)))
    users = result.scalars().all()

    imported = 0
    skipped = 0
    for user in users:
        if user.external_idp == KRATOS_IDP and user.external_subject is not None:
            skipped += 1
            continue
        if user.password_hash is None:
            logger.warning("user %s has no password_hash and no kratos link — skipping", user.id)
            skipped += 1
            continue

        schema_id = _SCHEMA_BY_ROLE[user.role]
        existing = await kratos.find_identity_by_email(email=user.email)
        if existing is not None:
            identity = existing
            logger.info("re-linking user %s to existing identity %s", user.id, identity.id)
        else:
            identity = await kratos.import_identity(
                schema_id=schema_id,
                email=user.email,
                hashed_password=user.password_hash,
            )
            logger.info("imported user %s as identity %s (%s)", user.id, identity.id, schema_id)

        user.external_idp = KRATOS_IDP
        user.external_subject = identity.id
        imported += 1

    await session.flush()
    logger.info("kratos identity import: %d linked, %d skipped", imported, skipped)
    return imported, skipped


async def _run(session: AsyncSession) -> None:
    async with httpx.AsyncClient(timeout=10.0) as http:
        await import_identities(session, KratosClient(get_settings(), http))


def main() -> None:
    run_script(_run)


if __name__ == "__main__":
    main()
