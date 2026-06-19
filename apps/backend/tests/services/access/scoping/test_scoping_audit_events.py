"""Audit events for pathway access changes (the `pathway-audit` change).

Setting a pathway's specialisms / practitioners emits one `updated` event with
an added/removed id diff, anchored to the Pathway; a no-op re-save emits nothing.
"""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.audit import AuditAction
from app.db.models.audit import AuditEvent
from app.db.models.pathway import Pathway
from app.db.models.practitioner.specialism import Specialism
from app.db.models.user import User
from app.schemas.auth.auth import SessionUser
from app.services.access.scoping.scoping_service import ScopingService
from app.services.pathway.audit_events import OP_ASSIGN_PRACTITIONERS, OP_SCOPE_SPECIALISMS
from scripts.seed_users import CAREGIVER_EMAIL


async def _events(session: AsyncSession, resource_id: UUID) -> Sequence[AuditEvent]:
    result = await session.execute(
        select(AuditEvent)
        .where(AuditEvent.resource_id == resource_id)
        .order_by(AuditEvent.created_at)
    )
    return list(result.scalars())


async def _pathway(session: AsyncSession) -> Pathway:
    pathway = Pathway(name="Scoped path", clinical_goal=None, patient_goal=None)
    session.add(pathway)
    await session.commit()
    return pathway


async def _specialism(session: AsyncSession, code: str) -> Specialism:
    row = Specialism(code=code, display=code.title())
    session.add(row)
    await session.commit()
    return row


async def test_scope_specialisms_emits_diff(
    db_session: AsyncSession, seeded_zas_users: list[User], session_actor: SessionUser
) -> None:
    del seeded_zas_users
    pathway = await _pathway(db_session)
    cardio = await _specialism(db_session, "cardiology")
    neuro = await _specialism(db_session, "neurology")
    service = ScopingService(db_session)

    await service.set_pathway_specialisms(
        session_actor, pathway_id=pathway.id, specialism_ids=[cardio.id, neuro.id]
    )

    events = await _events(db_session, pathway.id)
    assert len(events) == 1
    ev = events[0]
    assert ev.action == AuditAction.UPDATED
    assert ev.resource_type == "Pathway"
    assert (ev.context or {})["operation"] == OP_SCOPE_SPECIALISMS
    assert set((ev.context or {})["added"]) == {str(cardio.id), str(neuro.id)}
    assert (ev.context or {})["removed"] == []


async def test_assign_practitioners_emits_diff(
    db_session: AsyncSession, seeded_zas_users: list[User], session_actor: SessionUser
) -> None:
    pathway = await _pathway(db_session)
    caregiver = next(u for u in seeded_zas_users if u.email == CAREGIVER_EMAIL)
    service = ScopingService(db_session)

    await service.set_pathway_practitioners(
        session_actor, pathway_id=pathway.id, user_ids=[caregiver.id]
    )

    events = await _events(db_session, pathway.id)
    assert len(events) == 1
    assert events[0].action == AuditAction.UPDATED
    assert (events[0].context or {})["operation"] == OP_ASSIGN_PRACTITIONERS
    assert (events[0].context or {})["added"] == [str(caregiver.id)]


async def test_noop_resave_emits_nothing(
    db_session: AsyncSession, seeded_zas_users: list[User], session_actor: SessionUser
) -> None:
    del seeded_zas_users
    pathway = await _pathway(db_session)
    cardio = await _specialism(db_session, "cardiology")
    service = ScopingService(db_session)

    await service.set_pathway_specialisms(
        session_actor, pathway_id=pathway.id, specialism_ids=[cardio.id]
    )
    # Same desired set again — no net change → no second event.
    await service.set_pathway_specialisms(
        session_actor, pathway_id=pathway.id, specialism_ids=[cardio.id]
    )

    events = await _events(db_session, pathway.id)
    assert len(events) == 1
