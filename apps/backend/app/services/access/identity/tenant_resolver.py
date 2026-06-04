"""Tenant-slug → tenant_id resolution for the mobile auth surface.

PoC seeds one tenant with slug `"zas"`. The mobile login request body
carries the slug; the backend resolves to a `tenant_id` before user
lookup. Production replicates this shape with one mobile build per
hospital (each carrying its tenant slug at build time).
"""

from __future__ import annotations

from uuid import UUID

from app.core.errors import AppError
from app.repositories.tenant.tenant_repository import TenantRepository


class UnknownTenantError(AppError):
    code = "security.auth.unknown_tenant"
    status_code = 400
    message = "Unknown tenant."


async def resolve_tenant_slug(slug: str, *, repo: TenantRepository) -> UUID:
    """Return the `tenant_id` UUID for `slug`. Raise `UnknownTenantError`
    when no active tenant matches. Slug match is case-sensitive — slugs
    are short, URL-safe identifiers, and the existing CHECK regex on
    `tenants.slug` already constrains them to lowercase.
    """

    tenant = await repo.get_by_slug(slug)
    if tenant is None:
        raise UnknownTenantError()
    return tenant.id
