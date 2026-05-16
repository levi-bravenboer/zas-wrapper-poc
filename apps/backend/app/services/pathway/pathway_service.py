from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from jsonschema import Draft202012Validator

from app.db.models.pathway import (
    Pathway,
    PathwayBlock,
    PathwayBlockBranch,
    PathwayBlockDeferredField,
    PathwayEdge,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayTimeMarker,
    PathwayTimingValue,
    PathwayVersion,
)
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.schemas.pathway.catalogue import (
    PathwayBlockType,
    PathwayPhaseTemplate,
)
from app.schemas.pathway.pathway import (
    PathwayBare,
    PathwayBlockBranchIn,
    PathwayBlockBranchOut,
    PathwayBlockDeferredFieldIn,
    PathwayBlockDeferredFieldOut,
    PathwayBlockIn,
    PathwayBlockOut,
    PathwayDefinitionReplace,
    PathwayEdgeIn,
    PathwayEdgeOut,
    PathwayLaneIn,
    PathwayLaneOut,
    PathwayPhaseIn,
    PathwayPhaseOut,
    PathwaySummary,
    PathwayTimeMarkerIn,
    PathwayTimeMarkerOut,
    PathwayTimingValueIn,
    PathwayTimingValueOut,
    PathwayVersionDefinition,
    PathwayWithVersionResponse,
)
from app.services.pathway.catalogue import (
    BLOCK_TYPES,
    PHASE_TEMPLATES,
    get_block_type,
)
from app.services.pathway.errors import (
    BlockConfigError,
    BranchOwnershipError,
    DeferredFieldError,
    EdgeValidationError,
    NoConceptVersionError,
    PathwayNotFoundError,
    PathwayValidationError,
    PathwayVersionImmutableError,
    PathwayVersionNotFoundError,
    UnknownBlockTypeError,
    UnknownLaneKindError,
    UnknownPhaseError,
)


class PathwayService:
    def __init__(
        self,
        repo: PathwayRepository,
        version_repo: PathwayVersionRepository,
    ) -> None:
        self._repo = repo
        self._version_repo = version_repo

    # ---- Read paths -------------------------------------------------------

    async def list_summaries(self, tenant_id: UUID) -> list[PathwaySummary]:
        rows = await self._repo.list_summaries(tenant_id)
        return [
            PathwaySummary(
                id=r.id,
                name=r.name,
                clinical_goal=r.clinical_goal,
                patient_goal=r.patient_goal,
                updated_at=r.updated_at,
                block_count=r.block_count,
                last_edited_at=r.last_edited_at,
                has_concept=r.has_concept,
                concept_version_id=r.concept_version_id,
                latest_published_version_id=r.latest_published_version_id,
                latest_published_version_no=r.latest_published_version_no,
                latest_published_at=r.latest_published_at,
            )
            for r in rows
        ]

    async def get_with_resolved_version(
        self, pathway_id: UUID, tenant_id: UUID
    ) -> PathwayWithVersionResponse:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        version = await self._version_repo.resolve_for_view(pathway_id)
        if version is None:
            # Backstop per spec Requirement 9 — every pathway must have at least
            # the `initial` row, so reaching here means corrupted state.
            raise PathwayVersionNotFoundError()
        definition = await self._build_version_definition(version)
        return PathwayWithVersionResponse(
            pathway=PathwayBare.model_validate(pathway),
            version=definition,
        )

    async def get_version_definition(
        self, pathway_id: UUID, version_id: UUID, tenant_id: UUID
    ) -> PathwayVersionDefinition:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        version = await self._version_repo.get_in_pathway(version_id, pathway_id)
        if version is None:
            raise PathwayVersionNotFoundError()
        return await self._build_version_definition(version)

    # ---- Catalogue surfaces ----------------------------------------------

    def list_block_types(self) -> list[PathwayBlockType]:
        return [
            PathwayBlockType(
                type=entry.type,
                label=entry.label,
                default_lane_kind_code=entry.default_lane_kind_code,
                config_schema=entry.config_schema,
                supports_branches=entry.supports_branches,
            )
            for entry in BLOCK_TYPES
        ]

    def list_phase_templates(self) -> list[PathwayPhaseTemplate]:
        return [
            PathwayPhaseTemplate(
                id=p.id,
                label=p.label,
                default_ord=p.default_ord,
                default_duration_days=p.default_duration_days,
            )
            for p in PHASE_TEMPLATES
        ]

    # ---- Write paths -----------------------------------------------------

    async def create_empty(
        self,
        tenant_id: UUID,
        name: str,
        *,
        clinical_goal: str,
        patient_goal: str,
    ) -> PathwayWithVersionResponse:
        del tenant_id  # stamped by audit hook from session.info[actor]
        pathway = Pathway(name=name, clinical_goal=clinical_goal, patient_goal=patient_goal)
        await self._repo.add(pathway)
        version = PathwayVersion(
            pathway_id=pathway.id,
            version_no=1,
            status="concept",
            kind="initial",
        )
        await self._version_repo.add(version)
        session = self._repo._session  # noqa: SLF001 — service owns repo internals here
        await session.refresh(version, ["created_at", "updated_at"])
        lane_kinds = await self._repo.lane_kinds_by_code()
        default_lane_codes = [
            ("patient", "Patiënt", True),
            ("caregiver", "Zorgteam", False),
            ("system", "Systeem", False),
        ]
        session.add_all(
            [
                PathwayLane(
                    id=uuid4(),
                    pathway_version_id=version.id,
                    pathway_lane_kind_id=lane_kinds[code].id,
                    label=label,
                    ord=(idx + 1) * 10,
                    is_default=is_default,
                )
                for idx, (code, label, is_default) in enumerate(default_lane_codes)
                if code in lane_kinds
            ]
        )
        await session.flush()
        definition = await self._build_version_definition(version)
        return PathwayWithVersionResponse(
            pathway=PathwayBare.model_validate(pathway),
            version=definition,
        )

    async def replace_definition(
        self,
        pathway_id: UUID,
        tenant_id: UUID,
        payload: PathwayDefinitionReplace,
    ) -> PathwayWithVersionResponse:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()

        concept = await self._version_repo.get_concept(pathway_id)
        if concept is None:
            # Per spec Requirement 3: the frontend must restore or fork-from-publish
            # before mutating a pathway whose only versions are published.
            raise NoConceptVersionError()
        if concept.status != "concept":
            # Defensive — partial unique index makes this unreachable.
            raise PathwayVersionImmutableError(concept.id)

        lane_kinds = await self._repo.lane_kinds_by_code()
        resolved = _ResolvedDefinition.from_payload(payload, lane_kinds=lane_kinds)

        pathway.name = payload.name
        pathway.clinical_goal = payload.clinical_goal
        pathway.patient_goal = payload.patient_goal
        await self._repo.delete_children(concept.id)
        await self._persist_children(concept.id, resolved)
        session = self._repo._session  # noqa: SLF001
        await session.refresh(pathway, ["updated_at"])
        await session.refresh(concept, ["updated_at"])

        definition = await self._build_version_definition(concept)
        return PathwayWithVersionResponse(
            pathway=PathwayBare.model_validate(pathway),
            version=definition,
        )

    async def soft_delete(self, pathway_id: UUID, tenant_id: UUID) -> None:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        await self._repo.soft_delete(pathway)

    # ---- Helpers ---------------------------------------------------------

    async def _build_version_definition(
        self, version: PathwayVersion
    ) -> PathwayVersionDefinition:
        children = await self._repo.fetch_children(version.id)
        lane_kinds = await self._repo.lane_kinds_by_code()
        code_by_id = {kind.id: code for code, kind in lane_kinds.items()}
        lanes_out: list[PathwayLaneOut] = []
        for lane in children.lanes:
            lanes_out.append(
                PathwayLaneOut(
                    id=lane.id,
                    pathway_lane_kind_id=lane.pathway_lane_kind_id,
                    lane_kind_code=code_by_id.get(lane.pathway_lane_kind_id, ""),
                    label=lane.label,
                    ord=lane.ord,
                    is_default=lane.is_default,
                )
            )
        return PathwayVersionDefinition(
            id=version.id,
            pathway_id=version.pathway_id,
            version_no=version.version_no,
            status=version.status,  # type: ignore[arg-type]
            kind=version.kind,  # type: ignore[arg-type]
            label=version.label,
            note=version.note,
            derived_from_version_id=version.derived_from_version_id,
            published_at=version.published_at,
            published_by=version.published_by,
            updated_at=version.updated_at,
            phases=[PathwayPhaseOut.model_validate(p) for p in children.phases],
            lanes=lanes_out,
            timing_values=[
                PathwayTimingValueOut.model_validate(tv) for tv in children.timing_values
            ],
            blocks=[PathwayBlockOut.model_validate(b) for b in children.blocks],
            branches=[PathwayBlockBranchOut.model_validate(br) for br in children.branches],
            edges=[PathwayEdgeOut.model_validate(e) for e in children.edges],
            time_markers=[PathwayTimeMarkerOut.model_validate(m) for m in children.time_markers],
            deferred_fields=[
                PathwayBlockDeferredFieldOut.model_validate(fr) for fr in children.deferred_fields
            ],
        )

    async def _persist_children(
        self, pathway_version_id: UUID, r: _ResolvedDefinition
    ) -> None:
        session = self._repo._session  # noqa: SLF001 — service owns repo internals here
        session.add_all(
            [
                PathwayPhase(
                    id=p.id,
                    pathway_version_id=pathway_version_id,
                    template_id=p.template_id,
                    label=p.label,
                    ord=p.ord,
                )
                for p in r.phases
            ]
        )
        session.add_all(
            [
                PathwayLane(
                    id=lane.id,
                    pathway_version_id=pathway_version_id,
                    pathway_lane_kind_id=r.lane_kind_ids[lane.id],
                    label=lane.label,
                    ord=lane.ord,
                    is_default=lane.is_default,
                )
                for lane in r.lanes
            ]
        )
        session.add_all(
            [
                PathwayTimingValue(
                    id=tv.id,
                    pathway_version_id=pathway_version_id,
                    kind=tv.kind,
                    fixed_days=tv.fixed_days,
                    enrollment_default_days=tv.enrollment_default_days,
                    enrollment_min_days=tv.enrollment_min_days,
                    enrollment_max_days=tv.enrollment_max_days,
                )
                for tv in r.timing_values
            ]
        )
        await session.flush()
        session.add_all(
            [
                PathwayBlock(
                    id=b.id,
                    pathway_version_id=pathway_version_id,
                    phase_id=b.phase_id,
                    lane_id=b.lane_id,  # type: ignore[arg-type] — resolver guarantees non-null
                    type=b.type,
                    label=b.label,
                    duration_value_id=b.duration_value_id,
                    config=b.config,
                    x=b.x,
                    y=b.y,
                )
                for b in r.blocks
            ]
        )
        await session.flush()
        session.add_all(
            [
                PathwayBlockBranch(id=br.id, block_id=br.block_id, label=br.label, ord=br.ord)
                for br in r.branches
            ]
        )
        await session.flush()
        session.add_all(
            [
                PathwayEdge(
                    id=e.id,
                    pathway_version_id=pathway_version_id,
                    source_block_id=e.source_block_id,
                    target_block_id=e.target_block_id,
                    source_branch_id=e.source_branch_id,
                    delay_value_id=e.delay_value_id,
                )
                for e in r.edges
            ]
        )
        session.add_all(
            [
                PathwayTimeMarker(
                    id=m.id,
                    pathway_version_id=pathway_version_id,
                    value_id=m.value_id,
                    label=m.label,
                )
                for m in r.time_markers
            ]
        )
        session.add_all(
            [
                PathwayBlockDeferredField(
                    id=fr.id, block_id=fr.block_id, field_path=fr.field_path
                )
                for fr in r.deferred_fields
            ]
        )
        await session.flush()


class _ResolvedDefinition:
    """Validated + materialized payload, ready for persistence.

    Walks the wire shape once, enforcing every cross-entity invariant the
    spec requires (block.type ∈ catalogue, lane resolves, phase belongs to
    payload, branch on branching block only per D19, edge endpoints exist,
    branch matches source, timing CHECK columns, field_path ∈ config_schema).
    On success exposes the resolved children for the service to persist verbatim.
    """

    def __init__(
        self,
        *,
        phases: list[PathwayPhaseIn],
        lanes: list[PathwayLaneIn],
        lane_kind_ids: dict[UUID, UUID],
        timing_values: list[PathwayTimingValueIn],
        blocks: list[PathwayBlockIn],
        branches: list[PathwayBlockBranchIn],
        edges: list[PathwayEdgeIn],
        time_markers: list[PathwayTimeMarkerIn],
        deferred_fields: list[PathwayBlockDeferredFieldIn],
    ) -> None:
        self.phases = phases
        self.lanes = lanes
        # lane.id -> pathway_lane_kind_id (DB FK)
        self.lane_kind_ids = lane_kind_ids
        self.timing_values = timing_values
        self.blocks = blocks
        self.branches = branches
        self.edges = edges
        self.time_markers = time_markers
        self.deferred_fields = deferred_fields

    @classmethod
    def from_payload(
        cls,
        payload: PathwayDefinitionReplace,
        *,
        lane_kinds: dict[str, PathwayLaneKind],
    ) -> _ResolvedDefinition:
        # ---- Phases
        phase_ids: set[UUID] = set()
        for phase in payload.phases:
            if phase.id in phase_ids:
                raise PathwayValidationError(
                    field=f"phases[{phase.id}]", reason="duplicate phase id"
                )
            phase_ids.add(phase.id)

        # ---- Lanes
        lane_kind_ids: dict[UUID, UUID] = {}
        resolved_lanes: list[PathwayLaneIn] = []
        for lane in payload.lanes:
            kind = lane_kinds.get(lane.lane_kind_code)
            if kind is None:
                raise UnknownLaneKindError(
                    field=f"lanes[{lane.id}].lane_kind_code",
                    reason=f"unknown lane kind '{lane.lane_kind_code}'",
                )
            if lane.id in lane_kind_ids:
                raise PathwayValidationError(field=f"lanes[{lane.id}]", reason="duplicate lane id")
            lane_kind_ids[lane.id] = kind.id
            resolved_lanes.append(lane)

        # ---- Timing values
        timing_ids: set[UUID] = set()
        for tv in payload.timing_values:
            if tv.id in timing_ids:
                raise PathwayValidationError(
                    field=f"timing_values[{tv.id}]", reason="duplicate timing value id"
                )
            timing_ids.add(tv.id)

        # ---- Blocks: type ∈ catalogue, phase ∈ payload, lane materialization,
        #              config validates against config_schema.
        block_ids: set[UUID] = set()
        block_types_by_id: dict[UUID, str] = {}
        materialized_blocks: list[PathwayBlockIn] = []
        for block in payload.blocks:
            if block.id in block_ids:
                raise PathwayValidationError(
                    field=f"blocks[{block.id}]", reason="duplicate block id"
                )
            block_ids.add(block.id)
            entry = get_block_type(block.type)
            if entry is None:
                raise UnknownBlockTypeError(
                    field=f"blocks[{block.id}].type",
                    reason=f"unknown block type '{block.type}'",
                )
            if block.phase_id not in phase_ids:
                raise UnknownPhaseError(
                    field=f"blocks[{block.id}].phase_id",
                    reason="phase_id not present in payload phases",
                )
            resolved_lane_id = _resolve_or_materialize_lane(
                block=block,
                entry=entry,
                lanes=resolved_lanes,
                lane_kind_ids=lane_kind_ids,
                lane_kinds=lane_kinds,
            )
            if resolved_lane_id is None:
                raise PathwayValidationError(
                    field=f"blocks[{block.id}].lane_id",
                    reason="block has no lane_id and no default lane could be materialized",
                )
            _validate_block_config(block.id, entry.config_schema, block.config)
            block_types_by_id[block.id] = block.type
            materialized_blocks.append(block.model_copy(update={"lane_id": resolved_lane_id}))

        # ---- Branches: catalogue.supports_branches per D19
        branch_ids: set[UUID] = set()
        block_id_by_branch: dict[UUID, UUID] = {}
        for branch in payload.branches:
            if branch.id in branch_ids:
                raise PathwayValidationError(
                    field=f"branches[{branch.id}]", reason="duplicate branch id"
                )
            branch_ids.add(branch.id)
            block_type = block_types_by_id.get(branch.block_id)
            if block_type is None:
                raise BranchOwnershipError(
                    field=f"branches[{branch.id}].block_id",
                    reason="block_id not present in payload blocks",
                )
            entry = get_block_type(block_type)
            assert entry is not None  # validated above
            if not entry.supports_branches:
                raise BranchOwnershipError(
                    field=f"branches[{branch.id}].block_id",
                    reason=f"block type '{block_type}' does not support branches",
                )
            block_id_by_branch[branch.id] = branch.block_id

        # ---- Edges: endpoints ∈ blocks, branch ∈ source block, uniqueness
        edge_ids: set[UUID] = set()
        edge_keys: set[tuple[UUID, UUID, UUID | None]] = set()
        for edge in payload.edges:
            if edge.id in edge_ids:
                raise EdgeValidationError(field=f"edges[{edge.id}]", reason="duplicate edge id")
            edge_ids.add(edge.id)
            if edge.source_block_id not in block_ids:
                raise EdgeValidationError(
                    field=f"edges[{edge.id}].source_block_id",
                    reason="source_block_id not present in payload blocks",
                )
            if edge.target_block_id not in block_ids:
                raise EdgeValidationError(
                    field=f"edges[{edge.id}].target_block_id",
                    reason="target_block_id not present in payload blocks",
                )
            if edge.source_branch_id is not None:
                owner = block_id_by_branch.get(edge.source_branch_id)
                if owner is None:
                    raise EdgeValidationError(
                        field=f"edges[{edge.id}].source_branch_id",
                        reason="source_branch_id not present in payload branches",
                    )
                if owner != edge.source_block_id:
                    raise EdgeValidationError(
                        field=f"edges[{edge.id}].source_branch_id",
                        reason="source_branch_id does not belong to source_block_id",
                    )
            if edge.delay_value_id is not None and edge.delay_value_id not in timing_ids:
                raise EdgeValidationError(
                    field=f"edges[{edge.id}].delay_value_id",
                    reason="delay_value_id not present in payload timing_values",
                )
            key = (edge.source_block_id, edge.target_block_id, edge.source_branch_id)
            if key in edge_keys:
                raise EdgeValidationError(
                    field=f"edges[{edge.id}]",
                    reason="duplicate edge (source_block_id, target_block_id, source_branch_id)",
                )
            edge_keys.add(key)

        # ---- Time markers
        marker_ids: set[UUID] = set()
        for marker in payload.time_markers:
            if marker.id in marker_ids:
                raise PathwayValidationError(
                    field=f"time_markers[{marker.id}]", reason="duplicate marker id"
                )
            marker_ids.add(marker.id)
            if marker.value_id not in timing_ids:
                raise PathwayValidationError(
                    field=f"time_markers[{marker.id}].value_id",
                    reason="value_id not present in payload timing_values",
                )

        # ---- Field resolutions: field_path ∈ block.config_schema
        # We resolve schemas once per block id.
        block_schemas: dict[UUID, dict[str, Any]] = {}
        for block in materialized_blocks:
            entry = get_block_type(block.type)
            assert entry is not None
            block_schemas[block.id] = entry.config_schema
        # Block.duration_value_id existence check
        for block in materialized_blocks:
            if block.duration_value_id is not None and block.duration_value_id not in timing_ids:
                raise PathwayValidationError(
                    field=f"blocks[{block.id}].duration_value_id",
                    reason="duration_value_id not present in payload timing_values",
                )

        resolution_ids: set[UUID] = set()
        for fr in payload.deferred_fields:
            if fr.id in resolution_ids:
                raise PathwayValidationError(
                    field=f"deferred_fields[{fr.id}]", reason="duplicate id"
                )
            resolution_ids.add(fr.id)
            schema = block_schemas.get(fr.block_id)
            if schema is None:
                raise DeferredFieldError(
                    field=f"deferred_fields[{fr.id}].block_id",
                    reason="block_id not present in payload blocks",
                )
            if not _field_path_in_schema(schema, fr.field_path):
                raise DeferredFieldError(
                    field=f"deferred_fields[{fr.id}].field_path",
                    reason=f"field_path '{fr.field_path}' not declared in block config_schema",
                )

        return cls(
            phases=list(payload.phases),
            lanes=resolved_lanes,
            lane_kind_ids=lane_kind_ids,
            timing_values=list(payload.timing_values),
            blocks=materialized_blocks,
            branches=list(payload.branches),
            edges=list(payload.edges),
            time_markers=list(payload.time_markers),
            deferred_fields=list(payload.deferred_fields),
        )


def _resolve_or_materialize_lane(
    *,
    block: PathwayBlockIn,
    entry: Any,  # BlockTypeEntry — typed loose to avoid circular import friction
    lanes: list[PathwayLaneIn],
    lane_kind_ids: dict[UUID, UUID],
    lane_kinds: dict[str, PathwayLaneKind],
) -> UUID | None:
    if block.lane_id is not None:
        if block.lane_id not in {lane.id for lane in lanes}:
            raise PathwayValidationError(
                field=f"blocks[{block.id}].lane_id",
                reason="lane_id not present in payload lanes",
            )
        return block.lane_id

    default_kind_code = entry.default_lane_kind_code
    kind = lane_kinds.get(default_kind_code)
    if kind is None:
        return None
    # Find an existing default lane in payload for this kind
    for lane in lanes:
        if lane.is_default and lane_kind_ids[lane.id] == kind.id:
            return lane.id
    # Materialize a new default lane row
    materialized_id = uuid4()
    new_ord = max((lane.ord for lane in lanes), default=-1) + 1
    new_lane = PathwayLaneIn(
        id=materialized_id,
        lane_kind_code=default_kind_code,
        label=kind.label,
        ord=new_ord,
        is_default=True,
    )
    lanes.append(new_lane)
    lane_kind_ids[materialized_id] = kind.id
    return materialized_id


def _validate_block_config(block_id: UUID, schema: dict[str, Any], config: dict[str, Any]) -> None:
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(config), key=lambda e: list(e.absolute_path))
    if not errors:
        return
    first = errors[0]
    path = ".".join(str(part) for part in first.absolute_path) or "(root)"
    raise BlockConfigError(
        field=f"blocks[{block_id}].config.{path}",
        reason=first.message,
    )


def _field_path_in_schema(schema: dict[str, Any], field_path: str) -> bool:
    """Walk a dot-separated path through a JSON schema's `properties` chain."""

    parts = field_path.split(".")
    cursor: dict[str, Any] | None = schema
    for part in parts:
        if cursor is None:
            return False
        properties = cursor.get("properties") if isinstance(cursor, dict) else None
        if not isinstance(properties, dict) or part not in properties:
            return False
        cursor = properties[part]
    return True
