from __future__ import annotations

from typing import Any, cast
from uuid import UUID, uuid4

from jsonschema import Draft202012Validator

from app.core.enums.audit import AuditAction
from app.db.models.pathway import (
    Pathway,
    PathwayBlock,
    PathwayBlockBranch,
    PathwayBlockDeferredField,
    PathwayLane,
    PathwayLaneKind,
    PathwayPhase,
    PathwayTimeMarker,
    PathwayTimingValue,
    PathwayVersion,
)
from app.db.models.pathway.block_mapper import to_domain as block_row_to_domain
from app.db.models.pathway.block_write_shim import block_in_to_orm_kwargs
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.domain.pathway import (
    EDGE_TIMING_KINDS,
    PHASE_TEMPLATES,
    SEEDED_OFFSET_DIRECTIONS,
)
from app.domain.pathway.blocks.catalogue import (
    BLOCK_CATALOGUE,
    get_catalogue_entry,
)
from app.domain.pathway.input_logic.derived_edges import (
    DerivedEdge,
    derive_edges_from_input_logic,
)
from app.schemas.pathway import (
    PathwayBlockType,
    PathwayEdgeOffsetDirection,
    PathwayEdgeTimingKind,
    PathwayPhaseTemplate,
)
from app.schemas.pathway.pathway import (
    PathwayBare,
    PathwayBlockBranchIn,
    PathwayBlockBranchOut,
    PathwayBlockDeferredFieldIn,
    PathwayBlockDeferredFieldOut,
    PathwayBlockIn,
    PathwayChildSummary,
    PathwayDefinitionReplace,
    PathwayLaneIn,
    PathwayLaneOut,
    PathwayParentReference,
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
from app.schemas.pathway.typed_blocks import PathwayTypedBlockOut, out_class_for_kind
from app.services.pathway.audit_events import (
    OP_CREATE,
    OP_DELETE,
    OP_DUPLICATE,
    OP_EDIT,
    edit_starts_new_session,
    record_pathway_event,
)
from app.services.pathway.nesting import assert_no_nested_pathway_cycles
from app.services.pathway.pathway_version_service import PathwayVersionService
from app.services.pathway.errors import (
    BlockConfigError,
    BlockLaneNotAllowedError,
    BranchOwnershipError,
    DeferredFieldError,
    NoConceptVersionError,
    PathwayBlockNotFoundError,
    PathwayHasReferrersError,
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

    async def get_block(
        self,
        pathway_id: UUID,
        block_id: UUID,
        tenant_id: UUID,
    ) -> PathwayTypedBlockOut:
        """Return one block as a typed discriminated-union member.

        Backs `GET /pathways/{pathway_id}/blocks/{block_id}` per chain
        slot #1 §4.2. Carepath authorization runs as a route dependency;
        this method only asserts ownership + tenancy then materialises
        the row via the same mapper used by the version-definition path.
        """
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        row = await self._repo.get_block_in_pathway(block_id, pathway_id)
        if row is None:
            raise PathwayBlockNotFoundError()
        return _block_row_to_typed_out(row)

    async def get_child_summary(self, pathway_id: UUID, tenant_id: UUID) -> PathwayChildSummary:
        """Drive the nested-pathway inspector preview. Counts come from the
        pathway's preferred version: the latest published if one exists,
        else the concept version. Returns zero counts if no version exists
        (defensive; every pathway is seeded with an `initial` concept).
        """
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        latest_published = await self._version_repo.get_latest_published(pathway_id)
        preferred = latest_published or await self._version_repo.get_concept(pathway_id)
        if preferred is None:
            lane_count, block_count = 0, 0
        else:
            lane_count, block_count = await self._repo.child_summary_counts(preferred.id)
        return PathwayChildSummary(
            id=pathway.id,
            name=pathway.name,
            lane_count=lane_count,
            block_count=block_count,
            latest_published_version_id=(
                latest_published.id if latest_published is not None else None
            ),
        )

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
        # Catalogue derived from the typed `BaseBlock` subclasses
        # (`pathway-model-foundations` §1.4 / §7.1). The legacy
        # `BlockTypeEntry` registry is retired; each entry is a
        # projection of per-kind `ClassVar` metadata via
        # `block_catalogue.BLOCK_CATALOGUE`.
        return list(BLOCK_CATALOGUE)

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

    def list_edge_timing_kinds(self) -> list[PathwayEdgeTimingKind]:
        return [
            PathwayEdgeTimingKind(
                kind=entry.kind,  # type: ignore[arg-type]
                label=entry.label,
                config_schema=entry.config_schema,
                ui_schema=entry.ui_schema,
            )
            for entry in EDGE_TIMING_KINDS
        ]

    def list_edge_offset_directions(self) -> list[PathwayEdgeOffsetDirection]:
        return [
            PathwayEdgeOffsetDirection(code=code, label=label, ord=ord_)
            for code, label, ord_ in SEEDED_OFFSET_DIRECTIONS
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
        lane_rows = [
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
        session.add_all(lane_rows)
        # Scaffold a Pre-op phase + §A1 StartBlock on the caregiver
        # lane so fresh pathways open ready to author.
        caregiver_kind = lane_kinds.get("caregiver")
        caregiver_lane = (
            next(
                (lane for lane in lane_rows if lane.pathway_lane_kind_id == caregiver_kind.id),
                None,
            )
            if caregiver_kind is not None
            else None
        )
        if caregiver_lane is not None:
            scaffold_phase = PathwayPhase(
                id=uuid4(),
                pathway_version_id=version.id,
                template_id="pre-op",
                label="Pre-op",
                ord=10,
            )
            session.add(scaffold_phase)
            # Flush so phase / lane FKs exist before adding the block.
            await session.flush()
            session.add(
                PathwayBlock(
                    id=uuid4(),
                    pathway_version_id=version.id,
                    phase_id=scaffold_phase.id,
                    lane_id=caregiver_lane.id,
                    kind="start",
                    label="Start",
                    input_logic={"rules": [], "aggregator": "all_of", "n_of_m": None},
                    timing_policy=None,
                    x=0,
                    y=0,
                )
            )
        await session.flush()
        record_pathway_event(
            session,
            action=AuditAction.CREATED,
            pathway_id=pathway.id,
            operation=OP_CREATE,
            context={"version_no": version.version_no},
        )
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
        """Replace the concept version's children.

        Slot #2 §6: every block payload is the typed `BaseBlock`
        subclass shape — the slot-#1 `typed_shape` flag is retired.
        """
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
        await self._validate_pathway_link_pinned_versions(resolved.blocks)
        await assert_no_nested_pathway_cycles(
            blocks=resolved.blocks,
            parent_pathway_id=pathway_id,
            tenant_id=tenant_id,
            repo=self._repo,
        )

        pathway.name = payload.name
        pathway.clinical_goal = payload.clinical_goal
        pathway.patient_goal = payload.patient_goal
        await self._repo.delete_children(concept.id)
        await self._persist_children(concept.id, resolved)
        session = self._repo._session  # noqa: SLF001
        await session.refresh(pathway, ["updated_at"])
        await session.refresh(concept, ["updated_at"])

        # One `edited` event per editing session — autosave fires this endpoint
        # repeatedly, so coalesce all but the first edit by the same actor
        # within the quiet window.
        if await edit_starts_new_session(session, pathway_id=pathway_id):
            record_pathway_event(
                session,
                action=AuditAction.UPDATED,
                pathway_id=pathway_id,
                operation=OP_EDIT,
                context={"version_no": concept.version_no, "version_id": concept.id},
            )

        definition = await self._build_version_definition(concept)
        return PathwayWithVersionResponse(
            pathway=PathwayBare.model_validate(pathway),
            version=definition,
        )

    async def _validate_pathway_link_pinned_versions(self, blocks: list[PathwayBlockIn]) -> None:
        # Cross-DB check: when a `pathway_link` block sets `version_pin='specific'`,
        # its `pinned_version_id` MUST be a real `pathway_version.id` owned by the
        # block's `target_pathway_id`. JSON Schema validates shape; this check
        # walks the DB. Schema-rejected cases (missing id, non-uuid) are skipped
        # here because they were already rejected upstream.
        to_check: list[tuple[UUID, UUID, UUID]] = []
        for block in blocks:
            if block.kind != "pathway_link":
                continue
            config = block.config or {}
            if config.get("version_pin") != "specific":
                continue
            pinned_raw = config.get("pinned_version_id")
            target_raw = config.get("target_pathway_id")
            if not pinned_raw or not target_raw:
                continue
            try:
                to_check.append((block.id, UUID(str(target_raw)), UUID(str(pinned_raw))))
            except (TypeError, ValueError):
                continue

        for block_id, target_pathway_id, pinned_version_id in to_check:
            version = await self._version_repo.get_in_pathway(pinned_version_id, target_pathway_id)
            if version is None:
                raise BlockConfigError(
                    field=f"blocks[{block_id}].config.pinned_version_id",
                    reason=("pinned_version_id does not belong to target_pathway_id"),
                )

    async def list_parent_references(
        self, pathway_id: UUID, tenant_id: UUID
    ) -> list[PathwayParentReference]:
        """Return pathways that reference `pathway_id` as a `pathway_link`
        target. Drives the delete-confirmation modal — a non-empty list
        blocks deletion until the references are removed.
        """
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        parent_ids = await self._repo.find_pathway_link_parents({pathway_id}, tenant_id)
        # Drop self in case some payload referenced its own id; cycle guard
        # rejects it at save-time but be defensive on read.
        parent_ids.discard(pathway_id)
        if not parent_ids:
            return []
        parents = await self._repo.get_many(parent_ids, tenant_id)
        return [PathwayParentReference(id=p.id, name=p.name) for p in parents]

    async def duplicate(
        self,
        pathway_id: UUID,
        tenant_id: UUID,
        source_version_id: UUID,
    ) -> PathwaySummary:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        source_version = await self._version_repo.get_in_pathway(source_version_id, pathway_id)
        if source_version is None:
            raise PathwayVersionNotFoundError()

        new_pathway = Pathway(
            name=f"{pathway.name} (kopie)",
            clinical_goal=pathway.clinical_goal,
            patient_goal=pathway.patient_goal,
        )
        await self._repo.add(new_pathway)

        new_version = PathwayVersion(
            pathway_id=new_pathway.id,
            version_no=1,
            status="concept",
            kind="initial",
        )
        await self._version_repo.add(new_version)

        version_service = PathwayVersionService(self._repo, self._version_repo)
        await version_service._copy_children(source_version.id, new_version.id)  # noqa: SLF001

        session = self._repo._session  # noqa: SLF001
        await session.flush()
        record_pathway_event(
            session,
            action=AuditAction.CREATED,
            pathway_id=new_pathway.id,
            operation=OP_DUPLICATE,
            context={
                "version_no": new_version.version_no,
                "source_pathway_id": pathway_id,
                "source_version_id": source_version_id,
            },
        )

        summaries = await self.list_summaries(tenant_id)
        return next(s for s in summaries if s.id == new_pathway.id)

    async def soft_delete(self, pathway_id: UUID, tenant_id: UUID) -> None:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        referrers = await self.list_parent_references(pathway_id, tenant_id)
        if referrers:
            raise PathwayHasReferrersError(
                referrers=[{"id": str(r.id), "name": r.name} for r in referrers]
            )
        await self._repo.soft_delete(pathway)
        record_pathway_event(
            self._repo._session,  # noqa: SLF001
            action=AuditAction.DELETED,
            pathway_id=pathway.id,
            operation=OP_DELETE,
            context={"name": pathway.name},
        )

    # ---- Helpers ---------------------------------------------------------

    async def _build_version_definition(self, version: PathwayVersion) -> PathwayVersionDefinition:
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
                    height_px=lane.height_px,
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
            blocks=[_block_row_to_typed_out(b) for b in children.blocks],
            branches=[PathwayBlockBranchOut.model_validate(br) for br in children.branches],
            # Derived edges per chain slot #2 §3.3: one entry per
            # `InputLogicRule` on each block. The runtime evaluator
            # consumes `input_logic` directly; this projection only
            # drives the canvas connector layer.
            edges=_derive_edges_for_response(children.blocks),
            time_markers=[PathwayTimeMarkerOut.model_validate(m) for m in children.time_markers],
            deferred_fields=[
                PathwayBlockDeferredFieldOut.model_validate(fr) for fr in children.deferred_fields
            ],
        )

    async def _persist_children(
        self,
        pathway_version_id: UUID,
        r: _ResolvedDefinition,
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
                    width_px=p.width_px,
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
                    height_px=lane.height_px,
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
        # Chain slot #1 §5.1: dual-write — legacy `(type, config)` payload
        # is shimmed into typed per-kind columns alongside the verbatim
        # legacy columns. Both shapes live on the same row until chain
        # slot #2 drops the legacy pair.
        session.add_all(
            [
                PathwayBlock(
                    **block_in_to_orm_kwargs(
                        b,
                        pathway_version_id=pathway_version_id,
                        lane_id=b.lane_id,  # type: ignore[arg-type] — resolver guarantees non-null
                    )
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
        # Edges retired in slot #2 §3 — the canvas connector layer
        # is derived from `block.input_logic` at read time.
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
                PathwayBlockDeferredField(id=fr.id, block_id=fr.block_id, field_path=fr.field_path)
                for fr in r.deferred_fields
            ]
        )
        await session.flush()


class _ResolvedDefinition:
    """Validated + materialized payload, ready for persistence.

    Walks the wire shape once, enforcing every cross-entity invariant the
    spec requires (block.kind ∈ catalogue, lane resolves, phase belongs to
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
        lane_kind_codes: dict[UUID, str] = {}
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
            lane_kind_codes[lane.id] = lane.lane_kind_code
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
            entry = get_catalogue_entry(block.kind)
            if entry is None:
                raise UnknownBlockTypeError(
                    field=f"blocks[{block.id}].type",
                    reason=f"unknown block type '{block.kind}'",
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
                lane_kind_codes=lane_kind_codes,
                lane_kinds=lane_kinds,
            )
            if resolved_lane_id is None:
                raise PathwayValidationError(
                    field=f"blocks[{block.id}].lane_id",
                    reason="block has no lane_id and no default lane could be materialized",
                )
            resolved_kind_code = lane_kind_codes[resolved_lane_id]
            if resolved_kind_code not in entry.allowed_lane_kind_codes:
                raise BlockLaneNotAllowedError(
                    block_id=block.id,
                    block_type=block.kind,
                    lane_kind_code=resolved_kind_code,
                    allowed=entry.allowed_lane_kind_codes,
                )
            _validate_block_config(block.id, entry.config_schema, block.config)
            block_types_by_id[block.id] = block.kind
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
            entry = get_catalogue_entry(block_type)
            assert entry is not None  # validated above
            if not entry.supports_branches:
                raise BranchOwnershipError(
                    field=f"branches[{branch.id}].block_id",
                    reason=f"block type '{block_type}' does not support branches",
                )
            block_id_by_branch[branch.id] = branch.block_id

        # Edges retired in chain slot #2 §3 — connectivity is now
        # authored via `block.input_logic` rules. §3.4 validator
        # (`_validate_input_logic_node_refs`) asserts every rule's
        # `node` resolves to a block in the payload below.
        _validate_input_logic_node_refs(payload.blocks, block_ids)

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
            entry = get_catalogue_entry(block.kind)
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
            time_markers=list(payload.time_markers),
            deferred_fields=list(payload.deferred_fields),
        )


def _resolve_or_materialize_lane(
    *,
    block: PathwayBlockIn,
    entry: PathwayBlockType,
    lanes: list[PathwayLaneIn],
    lane_kind_ids: dict[UUID, UUID],
    lane_kind_codes: dict[UUID, str],
    lane_kinds: dict[str, PathwayLaneKind],
) -> UUID | None:
    if block.lane_id is not None:
        if block.lane_id not in {lane.id for lane in lanes}:
            raise PathwayValidationError(
                field=f"blocks[{block.id}].lane_id",
                reason="lane_id not present in payload lanes",
            )
        return block.lane_id

    default_kind_code = entry.allowed_lane_kind_codes[0]
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
    lane_kind_codes[materialized_id] = default_kind_code
    return materialized_id


_BLOCK_ENVELOPE_KEYS: frozenset[str] = frozenset(
    {"name", "lane_kind", "input_logic", "timing_policy"}
)


def _validate_block_config(block_id: UUID, schema: dict[str, Any], config: dict[str, Any]) -> None:
    # Slot #2 §6 introduced typed envelope fields (`name`, `lane_kind`,
    # `input_logic`, `timing_policy`) that the frontend ships inside
    # the same `config` bag as the per-kind fields. The legacy slot #1
    # `CONFIG_SCHEMA` is `additionalProperties: false` and only declares
    # per-kind properties, so it spuriously rejects the envelope keys.
    # Pydantic strict validation in `block_in_to_typed` is authoritative
    # for those keys; strip them here before running the JSON Schema
    # pre-check.
    per_kind_config = {k: v for k, v in config.items() if k not in _BLOCK_ENVELOPE_KEYS}
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(per_kind_config), key=lambda e: list(e.absolute_path))
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


def _block_row_to_typed_out(row: PathwayBlock) -> PathwayTypedBlockOut:
    """Materialise a `PathwayBlock` ORM row into its typed discriminated-union
    response member (chain slot #1 §4.1).

    Dispatches via the mapper (`to_domain`) onto the typed `BaseBlock`
    subclass — picking up legacy `(type, config)` rows transparently via
    the `legacy_to_domain` fallback — then merges the row-level envelope
    fields and instantiates the matching `*BlockOut` for the kind.

    The legacy `type` / `label` / `config` ORM columns are surfaced on
    the envelope unchanged during chain slot #1 so the builder UI keeps
    rendering and autosaving while it migrates kind-by-kind onto the
    typed fields (`block_write_shim` §5.1). Slot #2 drops them.
    """
    domain = block_row_to_domain(row)
    out_cls = out_class_for_kind(domain.KIND)
    envelope: dict[str, Any] = {
        "id": row.id,
        "phase_id": row.phase_id,
        "lane_id": row.lane_id,
        "duration_value_id": row.duration_value_id,
        "x": row.x,
        "y": row.y,
    }
    out = out_cls.model_validate({**domain.model_dump(), **envelope, "kind": domain.KIND})
    # Cast: `out_class_for_kind` is typed as `type[BaseModel]` to keep the
    # registry table flat (Pydantic discriminated unions are runtime
    # constructs, not a single base class). The lookup table is keyed on
    # the same `kind` values as the union and only ever returns a member
    # of `PathwayTypedBlockOut`.
    return cast(PathwayTypedBlockOut, out)


def _derive_edges_for_response(blocks: list[PathwayBlock]) -> list[DerivedEdge]:
    """Walk every block row's `input_logic` to produce the derived edge list.

    Chain slot #2 §3.3: the canvas connector layer is computed from
    the typed `InputLogic` aggregate on each block. The mapper's
    `_normalise_input_logic` handles legacy list-shaped stubs, so a
    pre-migration row produces an empty rule list without raising.
    """
    edges: list[DerivedEdge] = []
    for row in blocks:
        domain = block_row_to_domain(row)
        edges.extend(derive_edges_from_input_logic(row.id, domain.input_logic))
    return edges


def _validate_input_logic_node_refs(
    blocks: list[PathwayBlockIn],
    block_ids: set[UUID],
) -> None:
    """Reject payloads whose `input_logic.node` refs miss a block (§3.4).

    Each rule references a producer block by id; the rule's typed
    `args` carry the same id. Any reference that does not resolve to
    a block in the same pathway version is a publish blocker.
    """
    for block in blocks:
        # The payload still arrives in the slot #1 wire shape (`config`
        # bag with an `input_logic` key); the new typed aggregate is
        # read off the typed write surface in slot #2 §6 once the
        # builder migrates. For now skim the bag defensively.
        config = block.config or {}
        raw_logic = config.get("input_logic")
        if not raw_logic:
            continue
        rules = raw_logic.get("rules") if isinstance(raw_logic, dict) else raw_logic
        if not isinstance(rules, list):
            continue
        for idx, rule in enumerate(rules):
            if not isinstance(rule, dict):
                continue
            node_str = rule.get("node")
            try:
                node = UUID(str(node_str))
            except (TypeError, ValueError):
                raise PathwayValidationError(
                    field=f"blocks[{block.id}].input_logic.rules[{idx}].node",
                    reason=f"not a valid uuid: {node_str!r}",
                )
            if node not in block_ids:
                raise PathwayValidationError(
                    field=f"blocks[{block.id}].input_logic.rules[{idx}].node",
                    reason=f"node {node} not present in payload blocks",
                )
