from __future__ import annotations

import uuid
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pathway import Pathway, PathwayLaneKind, PathwayVersion
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.schemas.pathway.pathway import (
    PathwayBlockBranchIn,
    PathwayBlockDeferredFieldIn,
    PathwayBlockIn,
    PathwayDefinitionReplace,
    PathwayEdgeIn,
    PathwayLaneIn,
    PathwayPhaseIn,
    PathwayTimeMarkerIn,
    PathwayTimingValueIn,
)
from app.services.pathway.errors import NestedPathwayCycleError
from app.services.pathway.nesting import (
    MAX_NESTED_PATHWAY_DEPTH,
    assert_no_nested_pathway_cycles,
)
from app.services.pathway.pathway_service import PathwayService

pytestmark = pytest.mark.asyncio


# ---------- Helpers -----------------------------------------------------------


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


def _pathway_link_block(
    *,
    phase_id: UUID,
    lane_id: UUID,
    target_pathway_id: UUID,
    block_id: UUID | None = None,
) -> PathwayBlockIn:
    return PathwayBlockIn(
        id=block_id or uuid.uuid4(),
        phase_id=phase_id,
        lane_id=lane_id,
        type="pathway_link",
        config={
            "target_pathway_id": str(target_pathway_id),
            "mode": "blocking",
        },
    )


def _payload(
    *,
    phases: list[PathwayPhaseIn],
    lanes: list[PathwayLaneIn],
    blocks: list[PathwayBlockIn],
) -> PathwayDefinitionReplace:
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


def _service(db_session: AsyncSession) -> PathwayService:
    return PathwayService(
        PathwayRepository(db_session),
        PathwayVersionRepository(db_session),
    )


async def _seed_concept_pathway(
    db_session: AsyncSession,
    *,
    name: str = "P",
) -> Pathway:
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


# ---------- Integration tests through the service ----------------------------


async def test_direct_self_link_rejected(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    del lane_kinds
    pathway = await _seed_concept_pathway(db_session, name="self")
    service = _service(db_session)
    phase = _phase()
    lane = _lane()
    block = _pathway_link_block(phase_id=phase.id, lane_id=lane.id, target_pathway_id=pathway.id)
    with pytest.raises(NestedPathwayCycleError) as exc:
        await service.replace_definition(
            pathway.id,
            pathway.tenant_id,
            _payload(phases=[phase], lanes=[lane], blocks=[block]),
        )
    assert exc.value.details is not None
    assert exc.value.details["cycle_kind"] == "self"


async def test_indirect_cycle_through_ancestor_rejected(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    """A → B already exists; adding B → A must be rejected."""

    del lane_kinds
    pathway_a = await _seed_concept_pathway(db_session, name="A")
    pathway_b = await _seed_concept_pathway(db_session, name="B")
    service = _service(db_session)

    # Persist A → B by replacing A's concept definition.
    phase_a = _phase()
    lane_a = _lane()
    block_a = _pathway_link_block(
        phase_id=phase_a.id, lane_id=lane_a.id, target_pathway_id=pathway_b.id
    )
    await service.replace_definition(
        pathway_a.id,
        pathway_a.tenant_id,
        _payload(phases=[phase_a], lanes=[lane_a], blocks=[block_a]),
    )
    await db_session.commit()

    # Now try to add B → A. The guard sees A in B's ancestor chain.
    phase_b = _phase()
    lane_b = _lane()
    block_b = _pathway_link_block(
        phase_id=phase_b.id, lane_id=lane_b.id, target_pathway_id=pathway_a.id
    )
    with pytest.raises(NestedPathwayCycleError) as exc:
        await service.replace_definition(
            pathway_b.id,
            pathway_b.tenant_id,
            _payload(phases=[phase_b], lanes=[lane_b], blocks=[block_b]),
        )
    assert exc.value.details is not None
    assert exc.value.details["cycle_kind"] == "ancestor"


async def test_distinct_chain_accepted(
    db_session: AsyncSession,
    lane_kinds: dict[str, PathwayLaneKind],
) -> None:
    """A → B → C is fine; adding C → D (a fresh distinct pathway) accepted."""

    del lane_kinds
    pathway_a = await _seed_concept_pathway(db_session, name="A")
    pathway_b = await _seed_concept_pathway(db_session, name="B")
    pathway_c = await _seed_concept_pathway(db_session, name="C")
    pathway_d = await _seed_concept_pathway(db_session, name="D")
    service = _service(db_session)

    for parent, child in ((pathway_a, pathway_b), (pathway_b, pathway_c)):
        phase = _phase()
        lane = _lane()
        block = _pathway_link_block(phase_id=phase.id, lane_id=lane.id, target_pathway_id=child.id)
        await service.replace_definition(
            parent.id,
            parent.tenant_id,
            _payload(phases=[phase], lanes=[lane], blocks=[block]),
        )
        await db_session.commit()

    # C → D is a fresh distinct target — accepted.
    phase = _phase()
    lane = _lane()
    block = _pathway_link_block(phase_id=phase.id, lane_id=lane.id, target_pathway_id=pathway_d.id)
    result = await service.replace_definition(
        pathway_c.id,
        pathway_c.tenant_id,
        _payload(phases=[phase], lanes=[lane], blocks=[block]),
    )
    assert len(result.version.blocks) == 1


# ---------- Unit test for bounded depth termination --------------------------


class _FakeRepo:
    """In-memory PathwayRepository stub exposing only `find_pathway_link_parents`.

    Models a directed graph `parents_of[child] -> {parent_ids}` so the cycle
    guard's BFS walks deterministically without touching the DB. Used to test
    the depth-cap behaviour without seeding a 10-deep nesting in Postgres.
    """

    def __init__(self, parents_of: dict[UUID, set[UUID]]) -> None:
        self._parents_of = parents_of

    async def find_pathway_link_parents(
        self,
        target_pathway_ids: list[UUID] | set[UUID],
        tenant_id: UUID,  # noqa: ARG002 — interface compat
    ) -> set[UUID]:
        out: set[UUID] = set()
        for target in target_pathway_ids:
            out |= self._parents_of.get(target, set())
        return out


async def test_bounded_depth_terminates_without_finding_far_ancestor() -> None:
    """With a chain longer than MAX_NESTED_PATHWAY_DEPTH, ancestors beyond
    the cap are NOT visited; a link to a far ancestor is therefore accepted.

    Chain: a[0] (= parent) ← a[1] ← a[2] ← … ← a[depth_total]
    `a[1]` links to `a[0]`, `a[2]` links to `a[1]`, etc. We walk up from
    `a[0]`, finding parents `a[1]`, `a[2]`, … one per level. Past the cap
    (`MAX_NESTED_PATHWAY_DEPTH`), the walk stops.
    """

    depth_total = MAX_NESTED_PATHWAY_DEPTH + 3
    ids = [uuid.uuid4() for _ in range(depth_total + 1)]
    parents_of: dict[UUID, set[UUID]] = {ids[i]: {ids[i + 1]} for i in range(depth_total)}
    repo = _FakeRepo(parents_of=parents_of)
    parent_pathway_id = ids[0]
    far_ancestor = ids[depth_total]  # beyond the cap

    phase = _phase()
    lane = _lane()
    block = _pathway_link_block(phase_id=phase.id, lane_id=lane.id, target_pathway_id=far_ancestor)

    # Far ancestor is past the cap → not in the computed ancestor set →
    # the guard does NOT raise. Within-cap ancestors (e.g. ids[1]) would.
    await assert_no_nested_pathway_cycles(
        blocks=[block],
        parent_pathway_id=parent_pathway_id,
        tenant_id=uuid.uuid4(),
        repo=repo,  # type: ignore[arg-type]
    )

    within_cap = ids[1]
    block_close = _pathway_link_block(
        phase_id=phase.id, lane_id=lane.id, target_pathway_id=within_cap
    )
    with pytest.raises(NestedPathwayCycleError):
        await assert_no_nested_pathway_cycles(
            blocks=[block_close],
            parent_pathway_id=parent_pathway_id,
            tenant_id=uuid.uuid4(),
            repo=repo,  # type: ignore[arg-type]
        )


async def test_unrelated_block_types_skipped() -> None:
    """Only `pathway_link` blocks are inspected; other types pass through."""

    parent_pathway_id = uuid.uuid4()
    repo = _FakeRepo(parents_of={})
    phase = _phase()
    lane = _lane()
    other_block = PathwayBlockIn(
        id=uuid.uuid4(),
        phase_id=phase.id,
        lane_id=lane.id,
        type="appointment",
        config={"title": "Intake"},
    )
    await assert_no_nested_pathway_cycles(
        blocks=[other_block],
        parent_pathway_id=parent_pathway_id,
        tenant_id=uuid.uuid4(),
        repo=repo,  # type: ignore[arg-type]
    )


# Force-import unused symbols so static analysers don't warn about the
# wide PathwayBlock*In import list — the symbols document the wire shape
# that `_payload` builds against.
_ = (
    PathwayBlockBranchIn,
    PathwayBlockDeferredFieldIn,
    PathwayEdgeIn,
    PathwayTimeMarkerIn,
    PathwayTimingValueIn,
)
