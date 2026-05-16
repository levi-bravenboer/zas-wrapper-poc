from __future__ import annotations

from app.core.errors import AppError


class CareTeamNotFoundError(AppError):
    code = "not-found.care_team.not_found"
    status_code = 404
    message = "Care team not found."


class ParticipantNotFoundError(AppError):
    """No open participant row for the given `(care_team_id, user_id)`."""

    code = "not-found.care_team_participant.not_found"
    status_code = 404
    message = "Care-team participant not found."


class ParticipantAlreadyOpenError(AppError):
    """Adding a participant who already has an open row on the same team.

    Mirrors the partial unique index `uq_care_team_participants_open_membership`.
    Surfaced as 409 to match the convention for duplicate-of-uniqueness errors.
    """

    code = "conflict.care_team_participant.already_open"
    status_code = 409
    message = "Practitioner already has an open membership on this team."


class CrossTenantUserError(AppError):
    code = "invalid.care_team_participant.cross_tenant_user"
    status_code = 422
    message = "User does not belong to the actor's tenant."


class CrossTenantPractitionerRoleError(AppError):
    code = "invalid.care_team_participant.cross_tenant_practitioner_role"
    status_code = 422
    message = "PractitionerRole does not belong to the actor's tenant."


class PractitionerRoleUserMismatchError(AppError):
    code = "invalid.care_team_participant.practitioner_role_user_mismatch"
    status_code = 422
    message = "PractitionerRole does not belong to the named user."
