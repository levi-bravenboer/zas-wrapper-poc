from __future__ import annotations

from app.core.errors import AppError


class PractitionerRoleNotFoundError(AppError):
    code = "not-found.practitioner_role.not_found"
    status_code = 404
    message = "PractitionerRole not found."


class CrossTenantPractitionerRoleError(AppError):
    code = "forbidden.practitioner_role.cross_tenant"
    status_code = 403
    message = "Cross-tenant PractitionerRole access is forbidden."


class DuplicateOpenAffiliationError(AppError):
    """An open PractitionerRole already exists for this (practitioner, org)."""

    code = "conflict.practitioner_role.duplicate_open_affiliation"
    status_code = 409
    message = "Practitioner already has an open role at this organisation."


class ClosedRolePromotionError(AppError):
    """Refuses to promote a closed (period_end set) role to primary."""

    code = "conflict.practitioner_role.closed_promotion"
    status_code = 409
    message = "Closed PractitionerRole cannot be marked primary."
