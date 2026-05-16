from __future__ import annotations

import uuid
from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pathway import Pathway, PathwayBlock, PathwayLaneKind, PathwayVersion
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.schemas.auth.auth import SessionUser
from app.schemas.pathway.pathway import (
    PathwayBlockBranchIn,
    PathwayBlockDeferredFieldIn,
    PathwayBlockIn,
    PathwayDefinitionReplace,
    PathwayEdgeIn,
    PathwayLaneIn,
    PathwayPhaseIn,
    PathwayTimingValueIn,
)
from app.services.pathway.errors import (
    BlockConfigError,
    BranchOwnershipError,
    DeferredFieldError,
    EdgeValidationError,
    NoConceptVersionError,
    PathwayNotFoundError,
    PathwayValidationError,
    PathwayVersionNotFoundError,
    UnknownBlockTypeError,
    UnknownLaneKindError,
    UnknownPhaseError,
)
from app.services.pathway.pathway_service import PathwayService


def _phase(label: str = "Pre-op", ord_: int = 0) -> PathwayPhaseIn:
    return PathwayPhaseIn(id=uuid.uuid4(), template_id="pre-op", label=label, ord=ord_)


def _lane(code: str = "caregiver", ord_: int = 0, is_default: bool = True) -> PathwayLaneIn:
    return PathwayLaneIn(
        id=uuid.uuid4(),
        lane_kind_code=code,
        label=code.title(),
        ord=ord_,
        is_default=is_default,
    )


def _appointment_block(
    phase_id: UUID,
    lane_id: UUID | None = None,
    title: str = "Intake",
) -> PathwayBlockIn:
    return PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase_id,
        lane_id=lane_id,
        type="appointment",
        label=title,
        config={"title": title},
    )


def _service(db_session: AsyncSession) -> PathwayService:
    return PathwayService(
        PathwayRepository(db_session),
        PathwayVersionRepository(db_session),
    )


def _minimal_payload(
    *,
    name: str = "Test",
    phases: list[PathwayPhaseIn] | None = None,
    lanes: list[PathwayLaneIn] | None = None,
    blocks: list[PathwayBlockIn] | None = None,
    branches: list[PathwayBlockBranchIn] | None = None,
    edges: list[PathwayEdgeIn] | None = None,
    timing_values: list[PathwayTimingValueIn] | None = None,
    deferred_fields: list[PathwayBlockDeferredFieldIn] | None = None,
) -> PathwayDefinitionReplace:
    return PathwayDefinitionReplace(
        name=name,
        phases=phases or [],
        lanes=lanes or [],
        blocks=blocks or [],
        branches=branches or [],
        edges=edges or [],
        timing_values=timing_values or [],
        deferred_fields=deferred_fields or [],
    )


# ---------- Read-side ---------------------------------------------------------


async def test_list_summaries_includes_block_count(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _appointment_block(phase.id, lane.id)
    await service.replace_definition(
        empty_pathway.id,
        empty_pathway.tenant_id,
        _minimal_payload(phases=[phase], lanes=[lane], blocks=[block]),
    )
    await db_session.commit()

    summaries = await service.list_summaries(empty_pathway.tenant_id)

    assert len(summaries) == 1
    assert summaries[0].id == empty_pathway.id
    assert summaries[0].block_count == 1
    assert summaries[0].has_concept is True
    assert summaries[0].latest_published_version_id is None


async def test_get_with_resolved_version_missing_raises(db_session: AsyncSession) -> None:
    service = _service(db_session)
    with pytest.raises(PathwayNotFoundError):
        await service.get_with_resolved_version(uuid.uuid4(), uuid.uuid4())


# ---------- Validation: catalogue ---------------------------------------------


async def test_unknown_block_type_raises(db_session: AsyncSession, empty_pathway: Pathway) -> None:
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase.id,
        lane_id=lane.id,
        type="nonexistent",
        config={},
    )
    with pytest.raises(UnknownBlockTypeError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(phases=[phase], lanes=[lane], blocks=[block]),
        )


async def test_unknown_phase_raises(db_session: AsyncSession, empty_pathway: Pathway) -> None:
    service = _service(db_session)
    lane = _lane()
    block = _appointment_block(phase_id=uuid.uuid4(), lane_id=lane.id)
    with pytest.raises(UnknownPhaseError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(lanes=[lane], blocks=[block]),
        )


async def test_unknown_lane_kind_raises(db_session: AsyncSession, empty_pathway: Pathway) -> None:
    service = _service(db_session)
    lane = _lane(code="alien-kind")
    phase = _phase()
    with pytest.raises(UnknownLaneKindError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(phases=[phase], lanes=[lane]),
        )


async def test_block_config_validates_against_schema(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    """Appointment requires `title`; empty config violates required field."""

    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase.id,
        lane_id=lane.id,
        type="appointment",
        config={},
    )
    with pytest.raises(BlockConfigError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(phases=[phase], lanes=[lane], blocks=[block]),
        )


# ---------- Timing validation -------------------------------------------------


def test_timing_value_rejects_runtime_kind() -> None:
    """`runtime` is not in the `Literal["fixed", "enrollment"]` typing."""

    with pytest.raises(ValidationError):
        PathwayTimingValueIn(id=uuid.uuid4(), kind="runtime", fixed_days=1)  # type: ignore[arg-type]


def test_timing_value_fixed_rejects_enrollment_columns() -> None:
    with pytest.raises(ValidationError):
        PathwayTimingValueIn(
            id=uuid.uuid4(),
            kind="fixed",
            fixed_days=7,
            enrollment_default_days=3,
        )


def test_timing_value_enrollment_requires_default() -> None:
    with pytest.raises(ValidationError):
        PathwayTimingValueIn(id=uuid.uuid4(), kind="enrollment")


# ---------- Branch / edge consistency ----------------------------------------


async def test_branch_on_non_branching_block_raises(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    """D19: branches only on `supports_branches=True` types (e.g. decision)."""

    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _appointment_block(phase.id, lane.id)  # appointment — not branching
    branch = PathwayBlockBranchIn(id=uuid.uuid4(), block_id=block.id, label="oops", ord=0)
    with pytest.raises(BranchOwnershipError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(phases=[phase], lanes=[lane], blocks=[block], branches=[branch]),
        )


async def test_duplicate_edge_raises(db_session: AsyncSession, empty_pathway: Pathway) -> None:
    """D20: (source, target, source_branch_id) must be unique."""

    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    a = _appointment_block(phase.id, lane.id, "A")
    b = _appointment_block(phase.id, lane.id, "B")
    edge1 = PathwayEdgeIn(id=uuid.uuid4(), source_block_id=a.id, target_block_id=b.id)
    edge2 = PathwayEdgeIn(id=uuid.uuid4(), source_block_id=a.id, target_block_id=b.id)
    with pytest.raises(EdgeValidationError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(phases=[phase], lanes=[lane], blocks=[a, b], edges=[edge1, edge2]),
        )


async def test_edge_source_branch_must_belong_to_source_block(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    decision_a = PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase.id,
        lane_id=lane.id,
        type="decision",
        config={"question": "?"},
    )
    decision_b = PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase.id,
        lane_id=lane.id,
        type="decision",
        config={"question": "?"},
    )
    target = _appointment_block(phase.id, lane.id, "T")
    branch_on_a = PathwayBlockBranchIn(id=uuid.uuid4(), block_id=decision_a.id, label="goed", ord=0)
    # Edge leaves decision_b but claims branch_on_a
    edge = PathwayEdgeIn(
        id=uuid.uuid4(),
        source_block_id=decision_b.id,
        target_block_id=target.id,
        source_branch_id=branch_on_a.id,
    )
    with pytest.raises(EdgeValidationError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(
                phases=[phase],
                lanes=[lane],
                blocks=[decision_a, decision_b, target],
                branches=[branch_on_a],
                edges=[edge],
            ),
        )


# ---------- Lane materialization ---------------------------------------------


async def test_lane_materialized_when_block_lane_id_null(
    db_session: AsyncSession,
    empty_pathway: Pathway,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    del lane_kinds
    service = _service(db_session)
    phase = _phase()
    block = _appointment_block(phase.id, lane_id=None)  # appointment default = caregiver
    result = await service.replace_definition(
        empty_pathway.id,
        empty_pathway.tenant_id,
        _minimal_payload(phases=[phase], blocks=[block]),
    )

    assert len(result.version.lanes) == 1
    materialized = result.version.lanes[0]
    assert materialized.lane_kind_code == "caregiver"
    assert materialized.is_default is True
    assert result.version.blocks[0].lane_id == materialized.id


# ---------- Field resolution -------------------------------------------------


async def test_deferred_field_rejects_unknown_path(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _appointment_block(phase.id, lane.id)
    bad = PathwayBlockDeferredFieldIn(id=uuid.uuid4(), block_id=block.id, field_path="not_in_schema")
    with pytest.raises(DeferredFieldError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(
                phases=[phase],
                lanes=[lane],
                blocks=[block],
                deferred_fields=[bad],
            ),
        )


async def test_deferred_field_accepts_declared_path(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _appointment_block(phase.id, lane.id)
    good = PathwayBlockDeferredFieldIn(id=uuid.uuid4(), block_id=block.id, field_path="location")
    result = await service.replace_definition(
        empty_pathway.id,
        empty_pathway.tenant_id,
        _minimal_payload(phases=[phase], lanes=[lane], blocks=[block], deferred_fields=[good]),
    )
    assert len(result.version.deferred_fields) == 1


# ---------- Soft delete + replace cascade ------------------------------------


async def test_soft_delete_hides_pathway(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _appointment_block(phase.id, lane.id)
    await service.replace_definition(
        empty_pathway.id,
        empty_pathway.tenant_id,
        _minimal_payload(phases=[phase], lanes=[lane], blocks=[block]),
    )
    await db_session.commit()

    await service.soft_delete(empty_pathway.id, empty_pathway.tenant_id)
    await db_session.commit()

    # Pathway hidden from list; concept version + children retained per spec
    # (soft-delete does not touch version rows in the two-level aggregate).
    summaries = await service.list_summaries(empty_pathway.tenant_id)
    assert summaries == []


async def test_replace_definition_overwrites_children(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    """Second `replace` cascades old children away then re-inserts new ones."""

    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    old_block = _appointment_block(phase.id, lane.id, "Old")
    await service.replace_definition(
        empty_pathway.id,
        empty_pathway.tenant_id,
        _minimal_payload(phases=[phase], lanes=[lane], blocks=[old_block]),
    )
    await db_session.commit()

    new_phase = _phase("Surgery", ord_=20)
    new_lane = _lane("system")
    new_block = PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=new_phase.id,
        lane_id=new_lane.id,
        type="milestone",
        label="Operatie",
        config={"label": "Operatie"},
    )
    result = await service.replace_definition(
        empty_pathway.id,
        empty_pathway.tenant_id,
        _minimal_payload(phases=[new_phase], lanes=[new_lane], blocks=[new_block]),
    )
    assert len(result.version.blocks) == 1
    assert result.version.blocks[0].id == new_block.id

    # All blocks for the pathway's concept version are the new ones.
    concept_id = result.version.id
    rows = await db_session.execute(
        select(PathwayBlock).where(PathwayBlock.pathway_version_id == concept_id)
    )
    assert {row.id for row in rows.scalars()} == {new_block.id}


# ---------- Misc -------------------------------------------------------------


async def test_replace_unknown_pathway_raises(db_session: AsyncSession) -> None:
    service = _service(db_session)
    with pytest.raises(PathwayNotFoundError):
        await service.replace_definition(uuid.uuid4(), uuid.uuid4(), _minimal_payload())


async def test_duplicate_block_id_in_payload_raises(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    shared_id = uuid.uuid4()
    a = PathwayBlockIn(
        id=shared_id,
        phase_id=phase.id,
        lane_id=lane.id,
        type="appointment",
        config={"title": "A"},
    )
    b = PathwayBlockIn(
        id=shared_id,
        phase_id=phase.id,
        lane_id=lane.id,
        type="appointment",
        config={"title": "B"},
    )
    with pytest.raises(PathwayValidationError):
        await service.replace_definition(
            empty_pathway.id,
            empty_pathway.tenant_id,
            _minimal_payload(phases=[phase], lanes=[lane], blocks=[a, b]),
        )


# ---------- Version lifecycle (concept enforcement) --------------------------


async def test_replace_without_concept_raises(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
    session_actor: SessionUser,
) -> None:
    """A pathway with no concept version (only published/archived) must reject PUT."""

    del lane_kinds
    pathway = Pathway(
        name="No-concept pathway",
        clinical_goal=None,
        patient_goal=None,
    )
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

    service = _service(db_session)
    with pytest.raises(NoConceptVersionError):
        await service.replace_definition(
            pathway.id, pathway.tenant_id, _minimal_payload()
        )


async def test_get_version_definition_unknown_version_raises(
    db_session: AsyncSession, empty_pathway: Pathway
) -> None:
    service = _service(db_session)
    with pytest.raises(PathwayVersionNotFoundError):
        await service.get_version_definition(
            empty_pathway.id, uuid.uuid4(), empty_pathway.tenant_id
        )
