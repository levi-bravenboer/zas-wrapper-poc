# Appointment-domain validator. Pure, no DB IO. Callers (test fixtures
# today; pathway runtime / HiX adapter / future routes tomorrow) build a
# spec and call `AppointmentValidator.validate(spec)`. A successful call
# returns `None`; a violation raises a typed `AppError` subclass that the
# caller surfaces as 422 at the HTTP boundary (when one exists).
#
# Cross-tenant invariants (patient / participants belong to the actor's
# tenant) need the actor's tenant id resolved by the caller — the
# validator does not load patients or users. Pass the tenant id explicitly.

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.core.errors import AppError


class EndsBeforeStartsError(AppError):
    code = "invalid.appointment.ends_before_starts"
    status_code = 422
    message = "Appointment `ends_at` must be strictly after `starts_at`."


class OnSiteLocationRequiredError(AppError):
    code = "invalid.appointment.on_site_location_required"
    status_code = 422
    message = "Appointment `location_text` is required when `modality='on_site'`."


class InvalidTitleError(AppError):
    code = "invalid.appointment.invalid_title"
    status_code = 422
    message = "Appointment `title` must be non-empty and at most 255 characters."


class LocationTextTooLongError(AppError):
    code = "invalid.appointment.location_text_too_long"
    status_code = 422
    message = "Appointment `location_text` must be at most 255 characters."


class InvalidLeadCountError(AppError):
    code = "invalid.appointment.invalid_lead_count"
    status_code = 422
    message = "Appointment participants MUST include exactly one `lead`."


class DuplicateParticipantUserError(AppError):
    code = "invalid.appointment.duplicate_participant_user"
    status_code = 422
    message = "Appointment participants MUST NOT include the same user twice."


class CrossTenantPatientError(AppError):
    code = "invalid.appointment.cross_tenant_patient"
    status_code = 422
    message = "Patient does not belong to the appointment's tenant."


class CrossTenantParticipantUserError(AppError):
    code = "invalid.appointment.cross_tenant_participant_user"
    status_code = 422
    message = "Participant user does not belong to the appointment's tenant."


@dataclass(frozen=True)
class AppointmentParticipantSpec:
    """Pre-persistence shape of one participant row.

    `user_tenant_id` is resolved by the caller (a lookup against `users`)
    and passed in so the validator stays IO-free.
    """

    user_id: UUID
    role: AppointmentParticipantRole
    user_tenant_id: UUID


@dataclass(frozen=True)
class AppointmentSpec:
    """Pre-persistence shape of an `Appointment` plus its participants.

    `patient_tenant_id` is resolved by the caller and passed in so the
    validator stays IO-free.
    """

    tenant_id: UUID
    patient_id: UUID
    patient_tenant_id: UUID
    title: str
    kind: AppointmentKind
    starts_at: datetime
    ends_at: datetime
    modality: AppointmentModality
    location_text: str | None
    status: AppointmentStatus
    participants: tuple[AppointmentParticipantSpec, ...]


TEXT_MAX_LENGTH = 255


class AppointmentValidator:
    """Stateless validator. Raises on first violation."""

    @staticmethod
    def validate(spec: AppointmentSpec) -> None:
        AppointmentValidator._validate_text(spec)
        AppointmentValidator._validate_temporal(spec)
        AppointmentValidator._validate_modality(spec)
        AppointmentValidator._validate_patient_tenant(spec)
        AppointmentValidator._validate_participants(spec)

    @staticmethod
    def _validate_text(spec: AppointmentSpec) -> None:
        # Mirror the varchar(255) columns so writers get a 422 instead of a
        # DB DataError (500).
        if not spec.title.strip() or len(spec.title) > TEXT_MAX_LENGTH:
            raise InvalidTitleError()
        if spec.location_text is not None and len(spec.location_text) > TEXT_MAX_LENGTH:
            raise LocationTextTooLongError()

    @staticmethod
    def _validate_temporal(spec: AppointmentSpec) -> None:
        if spec.ends_at <= spec.starts_at:
            raise EndsBeforeStartsError()

    @staticmethod
    def _validate_modality(spec: AppointmentSpec) -> None:
        if spec.modality is AppointmentModality.ON_SITE:
            if spec.location_text is None or spec.location_text.strip() == "":
                raise OnSiteLocationRequiredError()

    @staticmethod
    def _validate_patient_tenant(spec: AppointmentSpec) -> None:
        if spec.patient_tenant_id != spec.tenant_id:
            raise CrossTenantPatientError()

    @staticmethod
    def _validate_participants(spec: AppointmentSpec) -> None:
        if not spec.participants:
            raise InvalidLeadCountError()

        lead_count = sum(
            1 for p in spec.participants if p.role is AppointmentParticipantRole.LEAD
        )
        if lead_count != 1:
            raise InvalidLeadCountError()

        seen: set[UUID] = set()
        for participant in spec.participants:
            if participant.user_id in seen:
                raise DuplicateParticipantUserError()
            seen.add(participant.user_id)
            if participant.user_tenant_id != spec.tenant_id:
                raise CrossTenantParticipantUserError()
