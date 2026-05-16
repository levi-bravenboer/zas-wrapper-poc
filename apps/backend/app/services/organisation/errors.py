from __future__ import annotations

from app.core.errors import AppError


class OrganisationNotFoundError(AppError):
    code = "not-found.organisation.not_found"
    status_code = 404
    message = "Organisation not found."


class CrossTenantOrganisationError(AppError):
    code = "forbidden.organisation.cross_tenant"
    status_code = 403
    message = "Cross-tenant organisation reference is forbidden."
