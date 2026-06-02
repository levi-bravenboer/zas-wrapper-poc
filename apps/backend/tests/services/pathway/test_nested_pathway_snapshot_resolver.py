from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pathway import (
    Pathway,
    PathwayBlock,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayVersion,
)
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.schemas.pathway.pathway import (
    PathwayBlockIn,
    PathwayDefinitionReplace,
    PathwayLaneIn,
    PathwayPhaseIn,
    PathwayPublishRequest,
)
from app.services.pathway.errors import BlockConfigError
from app.services.pathway.pathway_service import PathwayService
from app.services.pathway.pathway_version_service import PathwayVersionService

pytestmark = pytest.mark.asyncio


# ---------- Helpers -----------------------------------------------------------


def _service(db_session: AsyncSession) -> PathwayService:
    return PathwayService(
        PathwayRepository(db_session),
        PathwayVersionRepository(db_session),
    )


def _version_service(db_session: AsyncSession) -> PathwayVersionService:
    return PathwayVersionService(
        PathwayRepository(db_session),
        PathwayVersionRepository(db_session),
    )


def _phase() -> PathwayPhaseIn:
    return PathwayPhaseIn(id=uuid.uuid4(), template_id="pre-op", label="P", ord=0)


def _lane() -> PathwayLaneIn:
    return PathwayLaneIn(
        id=uuid.uuid4(),
        lane_kind_code="system",
        label="System",
        ord=0,
        is_default=True,
    )


def _pathway_link(
    *,
    phase_id,
    lane_id,
    target_pathway_id,
    version_pin: str = "latest_published",
    pinned_version_id=None,
) -> PathwayBlockIn:
    config: dict[str, object] = {
        "target_pathway_id": str(target_pathway_id),
        "mode": "blocking",
        "version_pin": version_pin,
    }
    if pinned_version_id is not None:
        config["pinned_version_id"] = str(pinned_version_id)
    return PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase_id,
        lane_id=lane_id,
        type="pathway_link",
        config=config,
    )


def _payload(phases, lanes, blocks) -> PathwayDefinitionReplace:
    return PathwayDefinitionReplace(
        name="t",
        phases=phases,
        lanes=lanes,
        blocks=blocks,
        branches=[],
        edges=[],
        timing_values=[],
        time_markers=[],
        deferred_fields=[],
    )


async def _seed_concept_pathway(db_session: AsyncSession, *, name: str) -> Pathway:
    pathway = Pathway(name=name, clinical_goal=None, patient_goal=None)
    db_session.add(pathway)
    await db_session.flush()
    db_session.add(
        PathwayVersion(
            pathway_id=pathway.id,
            version_no=1,
            status="concept",
            kind="initial",
        )
    )
    await db_session.commit()
    return pathway


async def _publish(db_session: AsyncSession, pathway: Pathway) -> PathwayVersion:
    version_service = _version_service(db_session)
    version_repo = PathwayVersionRepository(db_session)
    concept = await version_repo.get_concept(pathway.id)
    assert concept is not None
    actor_id = concept.created_by
    await version_service.publish(
        pathway.id,
        pathway.tenant_id,
        PathwayPublishRequest(label="v1", note=None, clinically_approved=True),
        actor_id,
    )
    await db_session.commit()
    # Re-fetch the now-published version row.
    published = await version_repo.get_in_pathway(concept.id, pathway.id)
    assert published is not None
    return published


async def _pathway_link_block_row(
    db_session: AsyncSession, pathway_version_id
) -> PathwayBlock:
    stmt = select(PathwayBlock).where(
        PathwayBlock.pathway_version_id == pathway_version_id,
        PathwayBlock.type == "pathway_link",
    )
    row = (await db_session.execute(stmt)).scalar_one()
    return row


# ---------- Tests -------------------------------------------------------------


async def test_specific_pin_snapshots_configured_version(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    """version_pin='specific' captures the configured `pinned_version_id`."""

    del lane_kinds
    target = await _seed_concept_pathway(db_session, name="target")
    # Publish the target so we have a real pathway_version row to pin to.
    target_published = await _publish(db_session, target)

    parent = await _seed_concept_pathway(db_session, name="parent")
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _pathway_link(
        phase_id=phase.id,
        lane_id=lane.id,
        target_pathway_id=target.id,
        version_pin="specific",
        pinned_version_id=target_published.id,
    )
    await service.replace_definition(
        parent.id,
        parent.tenant_id,
        _payload(phases=[phase], lanes=[lane], blocks=[block]),
    )
    await db_session.commit()

    # Publish parent; snapshot resolver runs.
    parent_published = await _publish(db_session, parent)

    row = await _pathway_link_block_row(db_session, parent_published.id)
    assert row.snapshot_json is not None
    assert row.snapshot_json["tracking"] == "specific"
    assert row.snapshot_json["target_pathway_id"] == str(target.id)
    assert row.snapshot_json["resolved_version_id"] == str(target_published.id)


async def test_latest_published_pin_snapshots_latest(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    """version_pin='latest_published' captures the latest published version
    of the target at publish time."""

    del lane_kinds
    target = await _seed_concept_pathway(db_session, name="target")
    target_published = await _publish(db_session, target)

    parent = await _seed_concept_pathway(db_session, name="parent")
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _pathway_link(
        phase_id=phase.id,
        lane_id=lane.id,
        target_pathway_id=target.id,
        version_pin="latest_published",
    )
    await service.replace_definition(
        parent.id,
        parent.tenant_id,
        _payload(phases=[phase], lanes=[lane], blocks=[block]),
    )
    await db_session.commit()

    parent_published = await _publish(db_session, parent)
    row = await _pathway_link_block_row(db_session, parent_published.id)
    assert row.snapshot_json is not None
    assert row.snapshot_json["tracking"] == "latest_published"
    assert row.snapshot_json["target_pathway_id"] == str(target.id)
    assert row.snapshot_json["resolved_version_id"] == str(target_published.id)


async def test_latest_published_pin_publish_fails_without_target_publish(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    """If the target pathway has no published version, publishing the parent
    must fail with BlockConfigError — no silent unresolvable reference."""

    del lane_kinds
    target = await _seed_concept_pathway(db_session, name="target_unpublished")
    # No publish for target.

    parent = await _seed_concept_pathway(db_session, name="parent")
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _pathway_link(
        phase_id=phase.id,
        lane_id=lane.id,
        target_pathway_id=target.id,
        version_pin="latest_published",
    )
    await service.replace_definition(
        parent.id,
        parent.tenant_id,
        _payload(phases=[phase], lanes=[lane], blocks=[block]),
    )
    await db_session.commit()

    version_service = _version_service(db_session)
    version_repo = PathwayVersionRepository(db_session)
    concept = await version_repo.get_concept(parent.id)
    assert concept is not None
    with pytest.raises(BlockConfigError):
        await version_service.publish(
            parent.id,
            parent.tenant_id,
            PathwayPublishRequest(label="v1", note=None, clinically_approved=True),
            concept.created_by,
        )


# Force-import unused symbols so static analysers don't warn about the
# wide import list — these document the wire shape `_payload` builds.
_ = (PathwayLane, PathwayPhase)
