from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.appointment import (
    AppointmentKind,
    AppointmentModality,
    AppointmentParticipantRole,
    AppointmentStatus,
)
from app.core.enums.patient import Gender, PatientSource
from app.core.enums.user import Role
from app.db.models.appointment import Appointment, AppointmentParticipant
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from app.db.models.user import User


async def _bootstrap(session: AsyncSession) -> tuple[Tenant, User, Patient]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor_id = uuid.uuid4()
    actor = User(
        id=actor_id,
        tenant_id=tenant.id,
        created_by=actor_id,
        updated_by=actor_id,
        email="a@example.test",
        password_hash="hash",
        display_name="a",
        role=Role.ADMIN,
        is_active=True,
    )
    session.add(actor)
    await session.flush()
    org = Organisation(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code="prov",
        parent_organisation_id=None,
    )
    session.add(org)
    await session.flush()
    patient = Patient(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        primary_organisation_id=org.id,
        given_name="P",
        family_name="P",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    session.add(patient)
    await session.flush()
    return tenant, actor, patient


async def _new_appointment(
    session: AsyncSession, tenant: Tenant, actor: User, patient: Patient
) -> Appointment:
    starts = datetime.now(UTC) + timedelta(days=1)
    appointment = Appointment(
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        patient_id=patient.id,
        title="t",
        kind=AppointmentKind.CONSULTATION,
        starts_at=starts,
        ends_at=starts + timedelta(hours=1),
        modality=AppointmentModality.ONLINE,
        location_text=None,
        status=AppointmentStatus.BOOKED,
    )
    session.add(appointment)
    await session.flush()
    return appointment


async def test_check_constraint_rejects_ends_before_starts(db_session: AsyncSession) -> None:
    tenant, actor, patient = await _bootstrap(db_session)
    now = datetime.now(UTC)
    db_session.add(
        Appointment(
            tenant_id=tenant.id,
            created_by=actor.id,
            updated_by=actor.id,
            patient_id=patient.id,
            title="t",
            kind=AppointmentKind.CONSULTATION,
            starts_at=now,
            ends_at=now,
            modality=AppointmentModality.ONLINE,
            status=AppointmentStatus.BOOKED,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_partial_unique_lead_rejects_second_active_lead(
    db_session: AsyncSession,
) -> None:
    tenant, actor, patient = await _bootstrap(db_session)
    appointment = await _new_appointment(db_session, tenant, actor, patient)
    db_session.add(
        AppointmentParticipant(
            tenant_id=tenant.id,
            appointment_id=appointment.id,
            user_id=actor.id,
            role=AppointmentParticipantRole.LEAD,
        )
    )
    await db_session.flush()
    other = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        email="b@example.test",
        password_hash="hash",
        display_name="b",
        role=Role.CAREGIVER,
        is_active=True,
    )
    db_session.add(other)
    await db_session.flush()
    db_session.add(
        AppointmentParticipant(
            tenant_id=tenant.id,
            appointment_id=appointment.id,
            user_id=other.id,
            role=AppointmentParticipantRole.LEAD,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_partial_unique_user_rejects_duplicate_open_row(
    db_session: AsyncSession,
) -> None:
    tenant, actor, patient = await _bootstrap(db_session)
    appointment = await _new_appointment(db_session, tenant, actor, patient)
    db_session.add(
        AppointmentParticipant(
            tenant_id=tenant.id,
            appointment_id=appointment.id,
            user_id=actor.id,
            role=AppointmentParticipantRole.LEAD,
        )
    )
    await db_session.flush()
    db_session.add(
        AppointmentParticipant(
            tenant_id=tenant.id,
            appointment_id=appointment.id,
            user_id=actor.id,
            role=AppointmentParticipantRole.SUPPORT,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_partial_unique_user_allows_reopen_after_soft_delete(
    db_session: AsyncSession,
) -> None:
    tenant, actor, patient = await _bootstrap(db_session)
    appointment = await _new_appointment(db_session, tenant, actor, patient)
    first = AppointmentParticipant(
        tenant_id=tenant.id,
        appointment_id=appointment.id,
        user_id=actor.id,
        role=AppointmentParticipantRole.SUPPORT,
    )
    db_session.add(first)
    await db_session.flush()
    first.deleted_at = datetime.now(UTC)
    await db_session.flush()
    db_session.add(
        AppointmentParticipant(
            tenant_id=tenant.id,
            appointment_id=appointment.id,
            user_id=actor.id,
            role=AppointmentParticipantRole.LEAD,
        )
    )
    await db_session.flush()
