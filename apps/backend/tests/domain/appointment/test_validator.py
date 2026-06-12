from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.domain.appointment import (
    AppointmentParticipantSpec,
    AppointmentSpec,
    AppointmentValidator,
    CrossTenantPatientError,
    CrossTenantParticipantUserError,
    DuplicateParticipantUserError,
    EndsBeforeStartsError,
    InvalidLeadCountError,
    InvalidTitleError,
    LocationTextTooLongError,
    OnSiteLocationRequiredError,
)


def _spec(
    *,
    tenant_id: UUID | None = None,
    patient_id: UUID | None = None,
    patient_tenant_id: UUID | None = None,
    title: str = "t",
    kind: AppointmentKind = AppointmentKind.CONSULTATION,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    modality: AppointmentModality = AppointmentModality.ONLINE,
    location_text: str | None = None,
    status: AppointmentStatus = AppointmentStatus.BOOKED,
    participants: tuple[AppointmentParticipantSpec, ...] | None = None,
) -> AppointmentSpec:
    tenant_id = tenant_id or uuid4()
    patient_id = patient_id or uuid4()
    patient_tenant_id = patient_tenant_id or tenant_id
    starts_at = starts_at or datetime.now(UTC) + timedelta(days=1)
    ends_at = ends_at or starts_at + timedelta(hours=1)
    if participants is None:
        participants = (
            AppointmentParticipantSpec(
                user_id=uuid4(),
                role=AppointmentParticipantRole.LEAD,
                user_tenant_id=tenant_id,
            ),
        )
    return AppointmentSpec(
        tenant_id=tenant_id,
        patient_id=patient_id,
        patient_tenant_id=patient_tenant_id,
        title=title,
        kind=kind,
        starts_at=starts_at,
        ends_at=ends_at,
        modality=modality,
        location_text=location_text,
        status=status,
        participants=participants,
    )


# ── text ──────────────────────────────────────────────────────────────────


def test_empty_title_rejected() -> None:
    with pytest.raises(InvalidTitleError):
        AppointmentValidator.validate(_spec(title=""))


def test_whitespace_title_rejected() -> None:
    with pytest.raises(InvalidTitleError):
        AppointmentValidator.validate(_spec(title="   "))


def test_title_over_255_rejected() -> None:
    with pytest.raises(InvalidTitleError):
        AppointmentValidator.validate(_spec(title="x" * 256))


def test_title_at_255_accepted() -> None:
    AppointmentValidator.validate(_spec(title="x" * 255))


def test_location_text_over_255_rejected() -> None:
    with pytest.raises(LocationTextTooLongError):
        AppointmentValidator.validate(
            _spec(modality=AppointmentModality.ON_SITE, location_text="x" * 256)
        )


def test_location_text_at_255_accepted() -> None:
    AppointmentValidator.validate(
        _spec(modality=AppointmentModality.ON_SITE, location_text="x" * 255)
    )


# ── temporal ──────────────────────────────────────────────────────────────


def test_ends_after_starts_accepted() -> None:
    AppointmentValidator.validate(_spec())


def test_ends_equal_to_starts_rejected() -> None:
    now = datetime.now(UTC)
    with pytest.raises(EndsBeforeStartsError):
        AppointmentValidator.validate(_spec(starts_at=now, ends_at=now))


def test_ends_before_starts_rejected() -> None:
    now = datetime.now(UTC)
    with pytest.raises(EndsBeforeStartsError):
        AppointmentValidator.validate(
            _spec(starts_at=now, ends_at=now - timedelta(minutes=1))
        )


def test_past_starts_at_accepted() -> None:
    past = datetime.now(UTC) - timedelta(days=7)
    AppointmentValidator.validate(_spec(starts_at=past, ends_at=past + timedelta(hours=1)))


# ── modality + location ──────────────────────────────────────────────────


def test_online_without_location_accepted() -> None:
    AppointmentValidator.validate(_spec(modality=AppointmentModality.ONLINE, location_text=None))


def test_on_site_without_location_rejected() -> None:
    with pytest.raises(OnSiteLocationRequiredError):
        AppointmentValidator.validate(
            _spec(modality=AppointmentModality.ON_SITE, location_text=None)
        )


def test_on_site_with_empty_location_rejected() -> None:
    with pytest.raises(OnSiteLocationRequiredError):
        AppointmentValidator.validate(
            _spec(modality=AppointmentModality.ON_SITE, location_text="   ")
        )


def test_on_site_with_location_accepted() -> None:
    AppointmentValidator.validate(
        _spec(modality=AppointmentModality.ON_SITE, location_text="Room 12")
    )


# ── participants ─────────────────────────────────────────────────────────


def test_zero_participants_rejected() -> None:
    with pytest.raises(InvalidLeadCountError):
        AppointmentValidator.validate(_spec(participants=()))


def test_zero_leads_rejected() -> None:
    tenant_id = uuid4()
    with pytest.raises(InvalidLeadCountError):
        AppointmentValidator.validate(
            _spec(
                tenant_id=tenant_id,
                patient_tenant_id=tenant_id,
                participants=(
                    AppointmentParticipantSpec(
                        user_id=uuid4(),
                        role=AppointmentParticipantRole.SUPPORT,
                        user_tenant_id=tenant_id,
                    ),
                ),
            )
        )


def test_two_leads_rejected() -> None:
    tenant_id = uuid4()
    with pytest.raises(InvalidLeadCountError):
        AppointmentValidator.validate(
            _spec(
                tenant_id=tenant_id,
                patient_tenant_id=tenant_id,
                participants=(
                    AppointmentParticipantSpec(
                        user_id=uuid4(),
                        role=AppointmentParticipantRole.LEAD,
                        user_tenant_id=tenant_id,
                    ),
                    AppointmentParticipantSpec(
                        user_id=uuid4(),
                        role=AppointmentParticipantRole.LEAD,
                        user_tenant_id=tenant_id,
                    ),
                ),
            )
        )


def test_duplicate_user_rejected() -> None:
    tenant_id = uuid4()
    duplicate = uuid4()
    with pytest.raises(DuplicateParticipantUserError):
        AppointmentValidator.validate(
            _spec(
                tenant_id=tenant_id,
                patient_tenant_id=tenant_id,
                participants=(
                    AppointmentParticipantSpec(
                        user_id=duplicate,
                        role=AppointmentParticipantRole.LEAD,
                        user_tenant_id=tenant_id,
                    ),
                    AppointmentParticipantSpec(
                        user_id=duplicate,
                        role=AppointmentParticipantRole.SUPPORT,
                        user_tenant_id=tenant_id,
                    ),
                ),
            )
        )


def test_cross_tenant_participant_rejected() -> None:
    tenant_id = uuid4()
    other_tenant_id = uuid4()
    with pytest.raises(CrossTenantParticipantUserError):
        AppointmentValidator.validate(
            _spec(
                tenant_id=tenant_id,
                patient_tenant_id=tenant_id,
                participants=(
                    AppointmentParticipantSpec(
                        user_id=uuid4(),
                        role=AppointmentParticipantRole.LEAD,
                        user_tenant_id=other_tenant_id,
                    ),
                ),
            )
        )


# ── patient tenant ───────────────────────────────────────────────────────


def test_cross_tenant_patient_rejected() -> None:
    tenant_id = uuid4()
    other_tenant_id = uuid4()
    with pytest.raises(CrossTenantPatientError):
        AppointmentValidator.validate(_spec(tenant_id=tenant_id, patient_tenant_id=other_tenant_id))
