from __future__ import annotations

from app.core.errors import AppError


class PatientNotFoundError(AppError):
    code = "not-found.patient.not_found"
    status_code = 404
    message = "Patient not found."


class PatientIdentifiersImmutableError(AppError):
    """PATCH /patients/{id} rejects identifier mutation in patients-base."""

    code = "invalid.patient.identifiers_immutable"
    status_code = 422
    message = "Identifiers cannot be mutated via PATCH; use the dedicated endpoint when available."


class PatientCreateCrossOrgForbiddenError(AppError):
    """POST /patients: caller without `patient.createCrossOrg` targeted an
    organisation that is not one of their own affiliated orgs."""

    code = "forbidden.patient.create_cross_org"
    status_code = 403
    message = "You may only create a patient in one of your own organisations."


class PatientOrganisationUnresolvedError(AppError):
    """POST /patients: no `primary_organisation_id` given and the caller's own
    organisation cannot be resolved unambiguously (none, or more than one)."""

    code = "invalid.patient.organisation_unresolved"
    status_code = 422
    message = "An organisation is required: none could be derived from your affiliations."
