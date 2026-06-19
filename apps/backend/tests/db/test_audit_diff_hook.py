from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.audit import ActorType, AuditAction
from app.core.enums.patient import Gender, PatientSource
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.audit import AuditEvent
from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from app.db.models.user import User
from tests.db.conftest import admin_session_user, seed_admin_user


async def _bootstrap(session: AsyncSession) -> tuple[Tenant, User, Organisation]:
    tenant = Tenant(id=uuid.uuid4(), slug="zas", name="ZAS")
    session.add(tenant)
    await session.flush()
    actor = await seed_admin_user(session, tenant_id=tenant.id, email="a@example.test")
    org = Organisation(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        created_by=actor.id,
        updated_by=actor.id,
        name="root",
        type_code="prov",
        parent_organisation_id=None,
    )
    session.add(org)
    await session.flush()
    session.info[SESSION_ACTOR_KEY] = admin_session_user(actor)
    return tenant, actor, org


def _new_patient(org_id: uuid.UUID) -> Patient:
    return Patient(
        primary_organisation_id=org_id,
        given_name="Hook",
        family_name="One",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )


async def _events(session: AsyncSession, resource_id: uuid.UUID) -> Sequence[AuditEvent]:
    result = await session.execute(
        select(AuditEvent)
        .where(AuditEvent.resource_id == resource_id)
        .order_by(AuditEvent.created_at)
    )
    return list(result.scalars().all())


async def test_create_emits_created_event(db_session: AsyncSession) -> None:
    _, actor, org = await _bootstrap(db_session)
    patient = _new_patient(org.id)
    db_session.add(patient)
    await db_session.flush()

    events = await _events(db_session, patient.id)
    assert len(events) == 1
    event = events[0]
    assert event.action == AuditAction.CREATED
    assert event.resource_type == "Patient"
    assert event.actor_type == ActorType.USER
    assert event.actor_id == actor.id
    assert event.actor_label == "Admin Actor"
    assert event.changes is not None
    assert event.changes["given_name"] == {"old": None, "new": "Hook"}
    # JSON-safe: UUID column serialised to str
    assert event.changes["primary_organisation_id"]["new"] == str(org.id)


async def test_update_emits_updated_event_excluding_updated_at(
    db_session: AsyncSession,
) -> None:
    _, _, org = await _bootstrap(db_session)
    patient = _new_patient(org.id)
    db_session.add(patient)
    await db_session.flush()

    patient.family_name = "Two"
    await db_session.flush()

    update = [e for e in await _events(db_session, patient.id) if e.action == AuditAction.UPDATED]
    assert len(update) == 1
    assert update[0].changes == {"family_name": {"old": "One", "new": "Two"}}
    assert "updated_at" not in (update[0].changes or {})


async def test_soft_delete_classified_as_deleted(db_session: AsyncSession) -> None:
    _, _, org = await _bootstrap(db_session)
    patient = _new_patient(org.id)
    db_session.add(patient)
    await db_session.flush()

    patient.deleted_at = datetime.now(timezone.utc)
    await db_session.flush()

    actions = {e.action for e in await _events(db_session, patient.id)}
    assert AuditAction.DELETED in actions
    assert AuditAction.UPDATED not in actions


async def test_non_audited_model_emits_nothing(db_session: AsyncSession) -> None:
    _, _, org = await _bootstrap(db_session)
    # Organisation is not __audited__.
    assert not await _events(db_session, org.id)


async def test_no_recursion_on_audit_event(db_session: AsyncSession) -> None:
    _, _, org = await _bootstrap(db_session)
    patient = _new_patient(org.id)
    db_session.add(patient)
    await db_session.flush()

    result = await db_session.execute(
        select(AuditEvent).where(AuditEvent.resource_type == "AuditEvent")
    )
    assert result.scalars().first() is None


async def test_user_excludes_password_hash(db_session: AsyncSession) -> None:
    tenant, actor, _ = await _bootstrap(db_session)
    new_id = uuid.uuid4()
    user = User(
        id=new_id,
        tenant_id=tenant.id,
        email="b@example.test",
        password_hash="secret-hash",
        display_name="B",
        role_id=actor.role_id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    events = await _events(db_session, new_id)
    assert len(events) == 1
    assert "password_hash" not in (events[0].changes or {})
