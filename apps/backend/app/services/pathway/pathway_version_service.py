from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select

from app.core.enums.audit import AuditAction
from app.db.models.pathway import (
    PathwayBlock,
    PathwayBlockBranch,
    PathwayBlockDeferredField,
    PathwayLane,
    PathwayPhase,
    PathwayTimeMarker,
    PathwayTimingValue,
    PathwayVersion,
)
from app.db.models.pathway.block_mapper import to_domain as block_row_to_domain
from app.domain.pathway.blocks.base import BaseBlock
from app.db.models.pathway.block_write_shim import block_row_clone_kwargs
from app.db.models.user import User
from app.domain.pathway.blocks.validators import (
    BlockPublishValidationError,
    DecisionOutputReferenceError,
    DecisionOutputsEmptyError,
    EndPathwayBlockMissingError,
    EndPathwayBlockShapeError,
    EventRuleError,
    IfNotDoneWithinRuleError,
    InformedConsentShapeError,
    InputLogicNodeUnknownError,
    validate_decision_block_outputs,
    validate_decision_output_references,
    validate_end_pathway_block_invariants,
    validate_event_rules,
    validate_if_not_done_within_rules,
    validate_informed_consent_invariants,
    validate_input_logic_node_references,
    validate_lane_kind,
    StartBlockCardinalityError,
    StartBlockShapeError,
    validate_publish_block,
    validate_start_block_invariants,
)
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.repositories.pathway.pathway_version_repository import PathwayVersionRepository
from app.schemas.pathway.pathway import (
    PathwayActorRef,
    PathwayPublishRequest,
    PathwayVersionSummary,
)
from app.services.pathway.errors import (
    BlockConfigError,
    BlockLaneNotAllowedError,
    ConceptAlreadyExistsError,
    ForkSourceNotPublishedError,
    NoConceptVersionError,
    PathwayNotFoundError,
    PathwayVersionNotFoundError,
)
from app.services.pathway.audit_events import (
    OP_FORK,
    OP_RESTORE,
    record_pathway_event,
)
from app.services.pathway.nesting import resolve_pathway_link_snapshots


class PathwayVersionService:
    """Lifecycle operations on `pathway_version` rows (publish, restore,
    fork-from-publish, list). Read of a single version's full definition stays
    on `PathwayService` so the catalogue/lane-kind plumbing isn't duplicated.
    """

    def __init__(
        self,
        repo: PathwayRepository,
        version_repo: PathwayVersionRepository,
    ) -> None:
        self._repo = repo
        self._version_repo = version_repo

    async def list_versions(self, pathway_id: UUID, tenant_id: UUID) -> list[PathwayVersionSummary]:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        versions = await self._version_repo.list_for_pathway(pathway_id)
        if not versions:
            return []
        actor_ids = {v.created_by for v in versions} | {
            v.published_by for v in versions if v.published_by is not None
        }
        actors = await self._fetch_actors(actor_ids)
        return [self._to_summary(v, actors) for v in versions]

    async def publish(
        self,
        pathway_id: UUID,
        tenant_id: UUID,
        payload: PathwayPublishRequest,
        actor_id: UUID,
    ) -> PathwayVersionSummary:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        concept = await self._version_repo.get_concept(pathway_id)
        if concept is None:
            raise NoConceptVersionError()
        # §6: publish-time validation gate.
        # 6.1 — every block instance must satisfy its typed subclass in
        #        Pydantic v2 strict mode (no value coercion). Surfaces as
        #        422 keyed on the block id so the builder canvas can
        #        highlight the offending block.
        # 6.2 — the block's lane.kind must be in the subclass's
        #        `allowed_lane_kinds` (D7 class-level invariant).
        await self._validate_publish_blocks(concept.id)
        # Resolve nested-pathway snapshots BEFORE flipping to published so a
        # failure (latest_published target with no published version) cancels
        # the publish entirely. Mutates `pathway_block.snapshot_json` on the
        # version's `pathway_link` blocks; flush is owned by `mark_published`.
        await resolve_pathway_link_snapshots(
            session=self._repo._session,  # noqa: SLF001 — service owns repo internals
            pathway_version_id=concept.id,
            version_repo=self._version_repo,
        )
        await self._version_repo.mark_published(
            concept,
            published_by=actor_id,
            label=payload.label,
            note=payload.note,
        )
        record_pathway_event(
            self._repo._session,  # noqa: SLF001
            action=AuditAction.PUBLISHED,
            pathway_id=pathway_id,
            context={
                "version_no": concept.version_no,
                "version_id": concept.id,
                "label": payload.label,
                "note": payload.note,
            },
        )
        actors = await self._fetch_actors({concept.created_by, actor_id})
        return self._to_summary(concept, actors)

    async def restore(
        self,
        pathway_id: UUID,
        source_version_id: UUID,
        tenant_id: UUID,
    ) -> PathwayVersionSummary:
        return await self._fork(
            pathway_id=pathway_id,
            source_version_id=source_version_id,
            tenant_id=tenant_id,
            kind="restore-from-version",
            require_published_source=False,
        )

    async def fork_from_publish(
        self,
        pathway_id: UUID,
        source_version_id: UUID,
        tenant_id: UUID,
    ) -> PathwayVersionSummary:
        return await self._fork(
            pathway_id=pathway_id,
            source_version_id=source_version_id,
            tenant_id=tenant_id,
            kind="fork-from-publish",
            require_published_source=True,
        )

    async def _validate_publish_blocks(self, pathway_version_id: UUID) -> None:
        """Run the publish-time per-block invariant checks (§6.1, §6.2).

        Loads each block as its typed `BaseBlock` subclass via the
        mapper, then:

        1. Re-validates the instance in Pydantic v2 strict mode and
           raises `BlockConfigError` (422) on failure — surfaces the
           Pydantic validation error path under
           `blocks[<id>].<field>` so the builder canvas can highlight
           the offending field.
        2. Asserts that the block's lane kind is in
           `block_cls.allowed_lane_kinds` (D7) — raises
           `BlockLaneNotAllowedError` otherwise.
        """
        children = await self._repo.fetch_children(pathway_version_id)
        lane_kind_codes = {
            lane.id: code
            for code, kind in (await self._repo.lane_kinds_by_code()).items()
            for lane in children.lanes
            if lane.pathway_lane_kind_id == kind.id
        }
        # Materialise the domain blocks once — slot #2 §5.2 walks the
        # cross-block `decision_output` reference graph below, which
        # needs every block already on the typed domain side.
        domain_blocks: dict[str, BaseBlock] = {}
        for row in children.blocks:
            domain = block_row_to_domain(row)
            domain_blocks[str(row.id)] = domain
            try:
                validate_publish_block(domain)
            except BlockPublishValidationError as err:
                raise BlockConfigError(
                    field=f"blocks[{row.id}]",
                    reason=str(err.cause),
                ) from err
            # Slot #2 §5.1: every decision block must declare outputs.
            try:
                validate_decision_block_outputs(domain)
            except DecisionOutputsEmptyError as err:
                raise BlockConfigError(
                    field=f"blocks[{row.id}].outputs",
                    reason=str(err),
                ) from err
            lane_kind = lane_kind_codes.get(row.lane_id)
            if lane_kind is None:
                # Defensive — fetch_children always returns the block's
                # lane row; missing lane_kind would mean a divergence.
                raise BlockConfigError(
                    field=f"blocks[{row.id}].lane_id",
                    reason="lane_kind_code unresolved at publish time",
                )
            try:
                validate_lane_kind(type(domain), lane_kind, block_name=domain.name)
            except Exception as err:
                raise BlockLaneNotAllowedError(
                    block_id=row.id,
                    block_type=type(domain).KIND,
                    lane_kind_code=lane_kind,
                    allowed=type(domain).allowed_lane_kinds,
                ) from err

        # Slot #2 §5.2: cross-block `decision_output` reference check.
        # Runs after the per-block validation pass so producers + their
        # `outputs` tuples are already typed-correct.
        try:
            validate_decision_output_references(domain_blocks)
        except DecisionOutputReferenceError as err:
            raise BlockConfigError(
                field=(
                    f"blocks[{next((bid for bid, b in domain_blocks.items() if b is err.target_block), '')}]"
                    f".input_logic.decision_output"
                ),
                reason=str(err),
            ) from err

        # Pathway-completion § C6: generic rule-level node reference
        # check — every `input_logic` rule must point at a block in
        # this version (the builder cascade-delete's safety net).
        try:
            validate_input_logic_node_references(domain_blocks)
        except InputLogicNodeUnknownError as err:
            raise BlockConfigError(
                field=(
                    f"blocks[{next((bid for bid, b in domain_blocks.items() if b is err.target_block), '')}]"
                    f".input_logic.rules[{err.rule_index}].node"
                ),
                reason=str(err),
            ) from err

        # Pathway-completion § B1.5: `if_not_done_within` rule checks
        # (same-version reference + parseable ISO duration).
        try:
            validate_if_not_done_within_rules(domain_blocks)
        except IfNotDoneWithinRuleError as err:
            raise BlockConfigError(
                field=(
                    f"blocks[{next((bid for bid, b in domain_blocks.items() if b is err.target_block), '')}]"
                    f".input_logic.if_not_done_within"
                ),
                reason=str(err),
            ) from err

        # Pathway-completion § B3.5: `event` rule checks (same-version
        # reference + event_type declared on the producer kind).
        try:
            validate_event_rules(domain_blocks)
        except EventRuleError as err:
            raise BlockConfigError(
                field=(
                    f"blocks[{next((bid for bid, b in domain_blocks.items() if b is err.target_block), '')}]"
                    f".input_logic.event"
                ),
                reason=str(err),
            ) from err

        # Pathway-completion § A8.6: InformedConsentBlock lifecycle shape
        # (no timing_policy; reminder/expiry ISO durations parse).
        try:
            validate_informed_consent_invariants(domain_blocks)
        except InformedConsentShapeError as err:
            consent_id = next(
                (bid for bid, b in domain_blocks.items() if type(b).KIND == "informed_consent"),
                "",
            )
            raise BlockConfigError(
                field=f"blocks[{consent_id}].{err.field}",
                reason=err.reason,
            ) from err

        # Catalogue-expansion § 1: pathway-wide StartBlock invariants.
        # Enforces exactly one StartBlock per version + empty
        # input_logic + null timing_policy on that block.
        try:
            validate_start_block_invariants(domain_blocks)
        except StartBlockCardinalityError as err:
            raise BlockConfigError(
                field="blocks",
                reason=str(err),
            ) from err
        except StartBlockShapeError as err:
            # Find the StartBlock id to surface the field path.
            start_id = next(
                (bid for bid, b in domain_blocks.items() if type(b).KIND == "start"),
                "",
            )
            raise BlockConfigError(
                field=f"blocks[{start_id}].{err.field}",
                reason=err.reason,
            ) from err

        # Catalogue-expansion § 2: pathway-wide EndPathwayBlock invariants.
        # Enforces ≥1 EndPathwayBlock per version + null timing_policy on
        # every terminal. `input_logic` is intentionally unrestricted —
        # authors gate which branch leads to which terminal.
        try:
            validate_end_pathway_block_invariants(domain_blocks)
        except EndPathwayBlockMissingError as err:
            raise BlockConfigError(
                field="blocks",
                reason=str(err),
            ) from err
        except EndPathwayBlockShapeError as err:
            end_id = next(
                (
                    bid
                    for bid, b in domain_blocks.items()
                    if type(b).KIND == "end_pathway" and b.timing_policy is not None
                ),
                "",
            )
            raise BlockConfigError(
                field=f"blocks[{end_id}].timing_policy",
                reason=err.reason,
            ) from err

    # ---- Helpers ---------------------------------------------------------

    async def _fork(
        self,
        *,
        pathway_id: UUID,
        source_version_id: UUID,
        tenant_id: UUID,
        kind: str,
        require_published_source: bool,
    ) -> PathwayVersionSummary:
        pathway = await self._repo.get(pathway_id, tenant_id)
        if pathway is None:
            raise PathwayNotFoundError()
        source = await self._version_repo.get_in_pathway(source_version_id, pathway_id)
        if source is None:
            raise PathwayVersionNotFoundError()
        if require_published_source and source.status != "published":
            raise ForkSourceNotPublishedError(
                field="version_id",
                reason=f"fork-from-publish requires source status='published', got '{source.status}'",
            )
        existing_concept = await self._version_repo.get_concept(pathway_id)
        if existing_concept is not None:
            raise ConceptAlreadyExistsError(existing_concept.id)

        next_no = await self._version_repo.next_version_no(pathway_id)
        new_version = PathwayVersion(
            pathway_id=pathway_id,
            version_no=next_no,
            status="concept",
            kind=kind,
            derived_from_version_id=source.id,
        )
        await self._version_repo.add(new_version)
        await self._copy_children(source.id, new_version.id)
        session = self._repo._session  # noqa: SLF001
        await session.refresh(new_version, ["created_at", "updated_at"])
        record_pathway_event(
            session,
            action=AuditAction.CREATED,
            pathway_id=pathway_id,
            operation=OP_FORK if require_published_source else OP_RESTORE,
            context={
                "version_no": new_version.version_no,
                "source_version_id": source.id,
                "source_version_no": source.version_no,
            },
        )
        actors = await self._fetch_actors({new_version.created_by})
        return self._to_summary(new_version, actors)

    async def _copy_children(self, source_version_id: UUID, target_version_id: UUID) -> None:
        """Deep-copy all child rows from one version to another, remapping UUIDs
        so cross-table references stay internally consistent in the new
        snapshot. Walks the FK graph: phase/lane/timing_value first (no internal
        deps), then block (deps on phase/lane/timing_value), then branch +
        deferred_field (deps on block), then edge (deps on block + branch +
        timing_value), then time_marker (dep on timing_value).
        """
        session = self._repo._session  # noqa: SLF001
        src = await self._repo.fetch_children(source_version_id)

        phase_id_map: dict[UUID, UUID] = {p.id: uuid4() for p in src.phases}
        lane_id_map: dict[UUID, UUID] = {lane.id: uuid4() for lane in src.lanes}
        timing_id_map: dict[UUID, UUID] = {tv.id: uuid4() for tv in src.timing_values}
        block_id_map: dict[UUID, UUID] = {b.id: uuid4() for b in src.blocks}
        branch_id_map: dict[UUID, UUID] = {br.id: uuid4() for br in src.branches}

        session.add_all(
            [
                PathwayPhase(
                    id=phase_id_map[p.id],
                    pathway_version_id=target_version_id,
                    template_id=p.template_id,
                    label=p.label,
                    ord=p.ord,
                    width_px=p.width_px,
                )
                for p in src.phases
            ]
        )
        session.add_all(
            [
                PathwayLane(
                    id=lane_id_map[lane.id],
                    pathway_version_id=target_version_id,
                    pathway_lane_kind_id=lane.pathway_lane_kind_id,
                    label=lane.label,
                    ord=lane.ord,
                    is_default=lane.is_default,
                    height_px=lane.height_px,
                )
                for lane in src.lanes
            ]
        )
        session.add_all(
            [
                PathwayTimingValue(
                    id=timing_id_map[tv.id],
                    pathway_version_id=target_version_id,
                    kind=tv.kind,
                    fixed_days=tv.fixed_days,
                    enrollment_default_days=tv.enrollment_default_days,
                    enrollment_min_days=tv.enrollment_min_days,
                    enrollment_max_days=tv.enrollment_max_days,
                )
                for tv in src.timing_values
            ]
        )
        await session.flush()

        # Chain slot #1 §5.1: dual-write — clone path round-trips through
        # the typed mapper so the new row inherits the per-kind columns
        # populated on the source row's chain-slot-#1 write.
        session.add_all(
            [
                PathwayBlock(
                    **block_row_clone_kwargs(
                        b,
                        new_id=block_id_map[b.id],
                        pathway_version_id=target_version_id,
                        phase_id=phase_id_map[b.phase_id],
                        lane_id=lane_id_map[b.lane_id],
                        duration_value_id=(
                            timing_id_map[b.duration_value_id]
                            if b.duration_value_id is not None
                            else None
                        ),
                        block_id_map=block_id_map,
                    )
                )
                for b in src.blocks
            ]
        )
        await session.flush()

        session.add_all(
            [
                PathwayBlockBranch(
                    id=branch_id_map[br.id],
                    block_id=block_id_map[br.block_id],
                    label=br.label,
                    ord=br.ord,
                )
                for br in src.branches
            ]
        )
        await session.flush()

        # Edges retired in slot #2 §3 — fork-from-publish carries
        # `block.input_logic` over with the block rows themselves
        # (cloned via `block_row_clone_kwargs`), so connectivity
        # follows automatically without a per-edge copy step.
        session.add_all(
            [
                PathwayTimeMarker(
                    id=uuid4(),
                    pathway_version_id=target_version_id,
                    value_id=timing_id_map[m.value_id],
                    label=m.label,
                )
                for m in src.time_markers
            ]
        )
        session.add_all(
            [
                PathwayBlockDeferredField(
                    id=uuid4(),
                    block_id=block_id_map[fr.block_id],
                    field_path=fr.field_path,
                )
                for fr in src.deferred_fields
            ]
        )
        await session.flush()

    async def _fetch_actors(self, user_ids: set[UUID]) -> dict[UUID, PathwayActorRef]:
        clean_ids = {uid for uid in user_ids if uid is not None}
        if not clean_ids:
            return {}
        session = self._repo._session  # noqa: SLF001
        result = await session.execute(select(User).where(User.id.in_(clean_ids)))
        return {
            user.id: PathwayActorRef(id=user.id, name=user.display_name)
            for user in result.scalars()
        }

    def _to_summary(
        self, version: PathwayVersion, actors: dict[UUID, PathwayActorRef]
    ) -> PathwayVersionSummary:
        return PathwayVersionSummary(
            id=version.id,
            pathway_id=version.pathway_id,
            version_no=version.version_no,
            status=version.status,  # type: ignore[arg-type]
            kind=version.kind,  # type: ignore[arg-type]
            label=version.label,
            note=version.note,
            derived_from_version_id=version.derived_from_version_id,
            created_at=version.created_at,
            created_by=actors.get(version.created_by),
            published_at=version.published_at,
            published_by=(
                actors.get(version.published_by) if version.published_by is not None else None
            ),
        )
