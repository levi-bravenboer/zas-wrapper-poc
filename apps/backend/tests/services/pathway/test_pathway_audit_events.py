"""Semantic audit events for care pathway authoring + access changes.

Covers the `pathway-audit` change: each authoring action emits one event with
the right action / `context.operation` / anchor / actor; draft edits coalesce to
one event per editing session; access changes carry an added/removed diff; and a
rolled-back op leaves no event.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.audit import ActorType, AuditAction, AuditResult
from app.db.models.audit import AuditEvent
from app.db.models.pathway import Pathway, PathwayLaneKind, PathwayVersion
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.pathway.pathway import (
    PathwayBlockIn,
    PathwayDefinitionReplace,
    PathwayLaneIn,
    PathwayPhaseIn,
    PathwayPublishRequest,
)
from app.services.pathway.audit_events import (
    EDIT_COALESCE_WINDOW,
    OP_DELETE,
    OP_DUPLICATE,
    OP_EDIT,
    OP_FORK,
    OP_RESTORE,
    edit_starts_new_session,
)
from app.services.pathway.pathway_service import PathwayService
from app.services.pathway.pathway_version_service import PathwayVersionService


def _svc(db_session: AsyncSession) -> PathwayService:
    return PathwayService(
        PathwayRepository(db_session),
        PathwayVersionRepository(db_session),
    )


def _vsvc(db_session: AsyncSession) -> PathwayVersionService:
    return PathwayVersionService(
        PathwayRepository(db_session),
        PathwayVersionRepository(db_session),
    )


async def _events(session: AsyncSession, resource_id: uuid.UUID) -> Sequence[AuditEvent]:
    result = await session.execute(
        select(AuditEvent)
        .where(AuditEvent.resource_id == resource_id)
        .order_by(AuditEvent.created_at)
    )
    return list(result.scalars())


def _phase(label: str = "Pre-op", ord_: int = 0) -> PathwayPhaseIn:
    return PathwayPhaseIn(id=uuid.uuid4(), template_id="pre-op", label=label, ord=ord_)


def _lane(code: str = "caregiver", ord_: int = 0, is_default: bool = True) -> PathwayLaneIn:
    return PathwayLaneIn(
        id=uuid.uuid4(), lane_kind_code=code, label=code.title(), ord=ord_, is_default=is_default
    )


def _appointment(phase_id: uuid.UUID, lane_id: uuid.UUID, title: str = "Intake") -> PathwayBlockIn:
    return PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase_id,
        lane_id=lane_id,
        kind="appointment",
        label=title,
        config={"title": title},
    )


def _edit_payload(name: str = "Test") -> PathwayDefinitionReplace:
    """A minimal valid draft save (one appointment) — enough for `edited`."""
    phase = _phase()
    lane = _lane()
    return PathwayDefinitionReplace(
        name=name,
        phases=[phase],
        lanes=[lane],
        blocks=[_appointment(phase.id, lane.id)],
        branches=[],
        timing_values=[],
        time_markers=[],
        deferred_fields=[],
    )


def _publishable_payload(name: str = "Publish me") -> PathwayDefinitionReplace:
    """Start + appointment + end_pathway — satisfies the §6 publish gate."""
    phase = _phase()
    caregiver = _lane("caregiver", 0, True)
    system = _lane("system", 1, False)
    return PathwayDefinitionReplace(
        name=name,
        phases=[phase],
        lanes=[caregiver, system],
        blocks=[
            PathwayBlockIn(
                id=uuid.uuid4(),
                phase_id=phase.id,
                lane_id=caregiver.id,
                kind="start",
                label="Start",
                config={"name": "Start"},
            ),
            _appointment(phase.id, caregiver.id),
            PathwayBlockIn(
                id=uuid.uuid4(),
                phase_id=phase.id,
                lane_id=system.id,
                kind="end_pathway",
                label="End",
                config={"name": "End"},
            ),
        ],
        branches=[],
        timing_values=[],
        time_markers=[],
        deferred_fields=[],
    )


# ---------- per-method emission ----------------------------------------------


async def test_create_empty_emits_created_event(
    db_session: AsyncSession, lane_kinds: dict[str, PathwayLaneKind]
) -> None:
    del lane_kinds
    response = await _svc(db_session).create_empty(
        uuid.uuid4(), "New path", clinical_goal="Goal", patient_goal="PGoal"
    )
    await db_session.commit()

    events = await _events(db_session, response.pathway.id)
    assert len(events) == 1
    ev = events[0]
    assert ev.action == AuditAction.CREATED
    assert ev.resource_type == "Pathway"
    assert (ev.context or {})["operation"] == "create"
    assert (ev.context or {})["version_no"] == 1
    assert ev.changes is None  # headline-only
    assert ev.actor_type == ActorType.USER
    assert ev.actor_id is not None


async def test_duplicate_emits_event_on_new_pathway(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    source_version = await PathwayVersionRepository(db_session).get_concept(empty_pathway.id)
    assert source_version is not None
    summary = await _svc(db_session).duplicate(
        empty_pathway.id, empty_pathway.tenant_id, source_version.id
    )
    await db_session.commit()

    # No event on the source; one on the new pathway, pointing back to source.
    assert await _events(db_session, empty_pathway.id) == []
    events = await _events(db_session, summary.id)
    assert len(events) == 1
    assert events[0].action == AuditAction.CREATED
    assert (events[0].context or {})["operation"] == OP_DUPLICATE
    assert (events[0].context or {})["source_pathway_id"] == str(empty_pathway.id)


async def test_soft_delete_emits_deleted_event(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    await _svc(db_session).soft_delete(empty_pathway.id, empty_pathway.tenant_id)
    await db_session.commit()

    events = await _events(db_session, empty_pathway.id)
    assert len(events) == 1
    assert events[0].action == AuditAction.DELETED
    assert (events[0].context or {})["operation"] == OP_DELETE
    assert (events[0].context or {})["name"] == empty_pathway.name


async def test_publish_emits_published_event(
    db_session: AsyncSession, empty_pathway: Pathway, session_actor: SessionUser
) -> None:
    await _svc(db_session).replace_definition(
        empty_pathway.id, empty_pathway.tenant_id, _publishable_payload()
    )
    await db_session.commit()
    await _vsvc(db_session).publish(
        empty_pathway.id,
        empty_pathway.tenant_id,
        PathwayPublishRequest(label="v1", note="first", clinically_approved=True),
        session_actor.id,
    )
    await db_session.commit()

    published = [
        e for e in await _events(db_session, empty_pathway.id) if e.action == AuditAction.PUBLISHED
    ]
    assert len(published) == 1
    ctx = published[0].context or {}
    assert ctx["version_no"] == 1
    assert ctx["label"] == "v1"
    assert "operation" not in ctx  # published needs no discriminator


async def test_restore_emits_restore_event(
    db_session: AsyncSession, lane_kinds: dict[str, PathwayLaneKind], session_actor: SessionUser
) -> None:
    """A pathway with only a published version → restore forks a new concept."""
    del lane_kinds
    pathway = Pathway(name="Pub only", clinical_goal=None, patient_goal=None)
    db_session.add(pathway)
    await db_session.flush()
    published = PathwayVersion(
        pathway_id=pathway.id,
        version_no=1,
        status="published",
        kind="initial",
        published_at=datetime.now(UTC),
        published_by=session_actor.id,
    )
    db_session.add(published)
    await db_session.commit()

    await _vsvc(db_session).restore(pathway.id, published.id, pathway.tenant_id)
    await db_session.commit()

    events = await _events(db_session, pathway.id)
    assert len(events) == 1
    assert events[0].action == AuditAction.CREATED
    assert (events[0].context or {})["operation"] == OP_RESTORE
    assert (events[0].context or {})["source_version_id"] == str(published.id)


async def test_fork_from_publish_emits_fork_event(
    db_session: AsyncSession, lane_kinds: dict[str, PathwayLaneKind], session_actor: SessionUser
) -> None:
    del lane_kinds
    pathway = Pathway(name="Pub only", clinical_goal=None, patient_goal=None)
    db_session.add(pathway)
    await db_session.flush()
    published = PathwayVersion(
        pathway_id=pathway.id,
        version_no=1,
        status="published",
        kind="initial",
        published_at=datetime.now(UTC),
        published_by=session_actor.id,
    )
    db_session.add(published)
    await db_session.commit()

    await _vsvc(db_session).fork_from_publish(pathway.id, published.id, pathway.tenant_id)
    await db_session.commit()

    events = await _events(db_session, pathway.id)
    assert len(events) == 1
    assert (events[0].context or {})["operation"] == OP_FORK


# ---------- anchoring / timeline ---------------------------------------------


async def test_pathway_history_is_one_query(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    svc = _svc(db_session)
    await svc.replace_definition(empty_pathway.id, empty_pathway.tenant_id, _edit_payload())
    await db_session.commit()
    await svc.soft_delete(empty_pathway.id, empty_pathway.tenant_id)
    await db_session.commit()

    events = await _events(db_session, empty_pathway.id)
    assert [e.action for e in events] == [AuditAction.UPDATED, AuditAction.DELETED]
    assert all(e.resource_type == "Pathway" for e in events)


# ---------- coalescing: full-service integration -----------------------------


async def test_rapid_edits_collapse_to_one(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    svc = _svc(db_session)
    for _ in range(3):
        await svc.replace_definition(empty_pathway.id, empty_pathway.tenant_id, _edit_payload())
        await db_session.commit()

    edits = [
        e for e in await _events(db_session, empty_pathway.id) if e.action == AuditAction.UPDATED
    ]
    assert len(edits) == 1


# ---------- atomicity (in-band) ----------------------------------------------


async def test_rolled_back_change_leaves_no_event(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    """In-band events commit with the mutation — a rollback discards both."""
    pathway_id = empty_pathway.id  # capture before rollback expires the instance
    await _svc(db_session).replace_definition(pathway_id, empty_pathway.tenant_id, _edit_payload())
    await db_session.rollback()  # simulate a failed request transaction
    assert await _events(db_session, pathway_id) == []


# ---------- coalescing: the reset-condition rule -----------------------------


async def _seed_event(
    session: AsyncSession,
    *,
    pathway_id: uuid.UUID,
    action: AuditAction,
    operation: str | None,
    actor_id: uuid.UUID | None,
    created_at: datetime,
) -> None:
    session.add(
        AuditEvent(
            actor_type=ActorType.USER if actor_id else ActorType.SYSTEM,
            actor_id=actor_id,
            action=action,
            result=AuditResult.SUCCESS,
            resource_type="Pathway",
            resource_id=pathway_id,
            context={"operation": operation} if operation else None,
            created_at=created_at,
        )
    )
    await session.commit()


async def test_edit_session_no_prior_event_emits(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    assert await edit_starts_new_session(db_session, pathway_id=empty_pathway.id) is True


async def test_edit_session_same_actor_in_window_suppresses(
    db_session: AsyncSession, empty_pathway: Pathway, session_actor: SessionUser
) -> None:
    await _seed_event(
        db_session,
        pathway_id=empty_pathway.id,
        action=AuditAction.UPDATED,
        operation=OP_EDIT,
        actor_id=session_actor.id,
        created_at=datetime.now(UTC),
    )
    assert await edit_starts_new_session(db_session, pathway_id=empty_pathway.id) is False


async def test_edit_session_window_elapsed_emits(
    db_session: AsyncSession, empty_pathway: Pathway, session_actor: SessionUser
) -> None:
    old = datetime.now(UTC) - (EDIT_COALESCE_WINDOW + timedelta(minutes=1))
    await _seed_event(
        db_session,
        pathway_id=empty_pathway.id,
        action=AuditAction.UPDATED,
        operation=OP_EDIT,
        actor_id=session_actor.id,
        created_at=old,
    )
    assert await edit_starts_new_session(db_session, pathway_id=empty_pathway.id) is True


async def test_edit_session_different_actor_emits(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    await _seed_event(
        db_session,
        pathway_id=empty_pathway.id,
        action=AuditAction.UPDATED,
        operation=OP_EDIT,
        actor_id=uuid.uuid4(),
        created_at=datetime.now(UTC),
    )
    assert await edit_starts_new_session(db_session, pathway_id=empty_pathway.id) is True


async def test_edit_session_intervening_lifecycle_emits(
    db_session: AsyncSession, empty_pathway: Pathway, session_actor: SessionUser
) -> None:
    await _seed_event(
        db_session,
        pathway_id=empty_pathway.id,
        action=AuditAction.PUBLISHED,
        operation=None,
        actor_id=session_actor.id,
        created_at=datetime.now(UTC),
    )
    assert await edit_starts_new_session(db_session, pathway_id=empty_pathway.id) is True


# ---------- read-API surface (no DB) -----------------------------------------


def test_published_is_filterable_but_operation_is_not() -> None:
    """`published` flows through the existing action filter; `context.operation`
    is display-only and intentionally NOT server-side filterable in v1."""
    from app.repositories.audit.audit_event_repository import AuditEventRepository

    assert "published" in {a.value for a in AuditAction}
    action_ops = AuditEventRepository.filterable_fields["action"]
    assert {"eq", "in"} <= action_ops
    # No JSONB / context.operation filter exposed.
    assert "context" not in AuditEventRepository.filterable_fields
    assert "operation" not in AuditEventRepository.filterable_fields
