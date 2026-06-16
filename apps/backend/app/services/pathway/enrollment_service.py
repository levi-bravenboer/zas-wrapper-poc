"""Enrollment service — owns runtime-aggregate creation + state transitions.

Composition: loads template blocks via the slot-#1/§2 mapper, derives
each `BlockExecution.scheduled_at` via the slot-#2 `TimingPolicy`
through the §3 scheduling helper, persists, then hands the in-memory
aggregate back to the runtime engine for the initial eligibility pass.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select

from app.db.models.patient import Patient
from app.db.models.pathway import (
    Pathway,
    PathwayBlockExecution,
    PathwayDeferredFieldValue,
    PathwayEnrollment,
    PathwayVersion,
)
from app.db.models.pathway.block_mapper import to_domain as block_row_to_domain
from app.domain.pathway.blocks.base import BaseBlock
from app.domain.pathway.blocks.end_pathway.typed import EndPathwayBlock
from app.domain.pathway.runtime.execution import (
    BlockExecution,
    InvalidTransitionError,
)
from app.domain.pathway.runtime.scheduling import schedule_from_anchor
from app.repositories.pathway.enrollment_repository import EnrollmentRepository
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.schemas.pathway.enrollment import (
    BlockExecutionResponse,
    DeferredFieldValueOut,
    DeferredFieldValuePatch,
    EnrollmentCreate,
    EnrollmentResponse,
    RuntimeTick,
)
from app.services.pathway.errors import (
    BlockExecutionNotFoundError,
    CrossTenantReferenceError,
    DeferredFieldMissingError,
    EnrollmentNotFoundError,
    InvalidExecutionResultError,
)
from app.services.pathway.runtime.engine import RuntimeEngine


class EnrollmentService:
    def __init__(
        self,
        pathway_repo: PathwayRepository,
        repo: EnrollmentRepository,
    ) -> None:
        self._pathway_repo = pathway_repo
        self._repo = repo

    async def create(
        self,
        payload: EnrollmentCreate,
        *,
        tenant_id: UUID,
    ) -> PathwayEnrollment:
        """Materialise a new enrollment + per-block executions + deferred values.

        §3.1 validation: every required `DeferredFieldSpec` on every
        block in the version must have a value in `payload`. Missing
        values are rejected before any row is inserted. Additionally,
        the patient and pathway version must both be visible to the
        caller's tenant — both FKs are tenant-owned elsewhere in the
        stack and bypassing the check here would let a caller seed
        enrollments against cross-tenant references.
        """
        # Cross-tenant guard: HTTP callers already pass the router-level
        # Keto-graduated guard
        # (`app.api.routers.pathway.enrollment_router._require_enrollment_access`
        # for enrollment-id-keyed routes, an inline
        # `resolve_patient_with_relation` + `require_carepath_access` pair
        # for the body-keyed `create_enrollment`). The service is also
        # reachable from non-HTTP callers (tests, future background jobs),
        # so we keep the defence-in-depth assertions here — surfaces a 422
        # instead of a foreign-key 500 a few flushes later.
        await self._assert_patient_in_tenant(payload.patient_id, tenant_id)
        await self._assert_pathway_version_in_tenant(payload.pathway_version_id, tenant_id)

        children = await self._pathway_repo.fetch_children(payload.pathway_version_id)
        templates: dict[UUID, BaseBlock] = {
            row.id: block_row_to_domain(row) for row in children.blocks
        }

        supplied: dict[tuple[UUID, str], object] = {
            (v.block_template_id, v.attr): v.value_json for v in payload.deferred_values
        }

        missing: list[str] = []
        for template_id, template in templates.items():
            for spec in template.DEFERRED_FIELDS:
                if not spec.required:
                    continue
                if (template_id, spec.attr) not in supplied:
                    missing.append(f"blocks[{template_id}].{spec.attr}")
        if missing:
            raise DeferredFieldMissingError(
                message=DeferredFieldMissingError.message,
                details={"missing": missing},
            )

        del tenant_id  # stamped by audit hook on the new rows

        session = self._repo._session  # noqa: SLF001
        enrollment = PathwayEnrollment(
            id=uuid4(),
            patient_id=payload.patient_id,
            pathway_version_id=payload.pathway_version_id,
            anchor_date=payload.anchor_date,
            state="active",
        )
        session.add(enrollment)
        # Flush before adding the child rows so PostgreSQL sees the
        # parent enrollment row before the FK-bound executions /
        # deferred values land in the same transaction.
        await session.flush()

        # Persist deferred values up front so the eligibility pass
        # below already sees them on the typed view.
        for v in payload.deferred_values:
            session.add(
                PathwayDeferredFieldValue(
                    id=uuid4(),
                    enrollment_id=enrollment.id,
                    block_template_id=v.block_template_id,
                    attr=v.attr,
                    value_json=v.value_json,
                )
            )

        # Compute each execution's schedule + due slots from the
        # block's `TimingPolicy` and the enrollment anchor. For the
        # `at_enrollment_picked_date` variant, look up the supplied
        # deferred value and mirror it onto `scheduled_at` so the
        # scheduler / dashboards can sort + filter without joining
        # the deferred-value table.
        for template_id, template in templates.items():
            timing_policy = (
                template.timing_policy.model_dump(mode="json")
                if template.timing_policy is not None
                else None
            )
            scheduled_at, due_at = schedule_from_anchor(payload.anchor_date, timing_policy)
            if (
                timing_policy is not None
                and timing_policy.get("kind") == "at_enrollment_picked_date"
            ):
                scheduled_at = _picked_scheduled_at(template, template_id, supplied)
            session.add(
                PathwayBlockExecution(
                    id=uuid4(),
                    enrollment_id=enrollment.id,
                    block_template_id=template_id,
                    scheduled_at=scheduled_at,
                    due_at=due_at,
                    state="pending",
                )
            )

        await session.flush()

        # Initial eligibility pass: blocks with empty `input_logic`
        # transition to `eligible` immediately so the caller doesn't
        # need a follow-up POST.
        await self._run_eligibility(enrollment, templates)

        return enrollment

    async def cancel(
        self,
        enrollment_id: UUID,
        *,
        tenant_id: UUID,
    ) -> EnrollmentResponse:
        """Cancel a running enrollment.

        Terminal (`completed`/`cancelled`) enrollments are left
        untouched — the call is idempotent. Dead-path cleanup of
        materialised appointments/tasks lands with the Temporal
        cancel Signal (tasks 3.6/4.3); here we only flip the
        aggregate state.
        """
        enrollment = await self.get(enrollment_id, tenant_id=tenant_id)
        if enrollment.state in ("active", "paused"):
            enrollment.state = "cancelled"
            await self._repo._session.flush()  # noqa: SLF001
        return await self._build_view(enrollment)

    async def advance(
        self,
        enrollment_id: UUID,
        *,
        tenant_id: UUID,
        now: datetime,
    ) -> RuntimeTick:
        """Re-run eligibility + auto-fire at `now`, persist, report next wake.

        The Temporal `PathwayEnrollmentWorkflow` calls this on start and
        whenever a durable timer fires: time-gated auto blocks
        (`message`/`external_program`) fire as their schedule elapses,
        and the workflow sleeps until the next pending `scheduled_at`.
        Terminal (`completed`/`cancelled`) enrollments are a no-op tick.
        """
        enrollment = await self.get(enrollment_id, tenant_id=tenant_id)
        if enrollment.state not in ("active", "paused"):
            return RuntimeTick(state=enrollment.state, next_wake_at=None, terminal=True)  # type: ignore[arg-type]

        children = await self._pathway_repo.fetch_children(enrollment.pathway_version_id)
        templates: dict[UUID, BaseBlock] = {
            row.id: block_row_to_domain(row) for row in children.blocks
        }
        await self._run_eligibility(enrollment, templates, now=now)

        executions = await self._load_executions(enrollment_id)
        next_wake_at = _next_auto_wake(executions, templates, now=now)
        terminal = enrollment.state not in ("active", "paused")
        return RuntimeTick(
            state=enrollment.state,  # type: ignore[arg-type]
            next_wake_at=next_wake_at,
            terminal=terminal,
        )

    async def get(self, enrollment_id: UUID, *, tenant_id: UUID) -> PathwayEnrollment:
        row = await self._repo.get(enrollment_id, tenant_id)
        if row is None:
            raise EnrollmentNotFoundError()
        return row

    async def get_view(
        self,
        enrollment_id: UUID,
        *,
        tenant_id: UUID,
    ) -> EnrollmentResponse:
        """Build the wire-shape `EnrollmentResponse` for the runtime aggregate.

        Keeps the router on a stable service seam — no router has to
        reach across into `service._repo` to assemble the view.
        """
        enrollment = await self.get(enrollment_id, tenant_id=tenant_id)
        return await self._build_view(enrollment)

    async def list_views_by_patient(
        self,
        patient_id: UUID,
        *,
        tenant_id: UUID,
    ) -> list[EnrollmentResponse]:
        """Build the runtime view for every enrollment a patient has.

        Care-team scope is enforced at the router seam; this method
        assumes the caller is already authorised to view the patient.
        """
        enrollments = await self._repo.list_by_patient(patient_id, tenant_id)
        return [await self._build_view(enrollment) for enrollment in enrollments]

    async def _build_view(self, enrollment: PathwayEnrollment) -> EnrollmentResponse:
        executions = await self._repo.list_executions(enrollment.id)
        deferred = await self._repo.list_deferred_values(enrollment.id)
        pathway_id = await self._repo._session.scalar(  # noqa: SLF001
            select(PathwayVersion.pathway_id).where(
                PathwayVersion.id == enrollment.pathway_version_id,
            )
        )
        if pathway_id is None:
            raise EnrollmentNotFoundError()
        return EnrollmentResponse(
            id=enrollment.id,
            patient_id=enrollment.patient_id,
            pathway_id=pathway_id,
            pathway_version_id=enrollment.pathway_version_id,
            anchor_date=enrollment.anchor_date,
            state=enrollment.state,  # type: ignore[arg-type]
            executions=[BlockExecutionResponse.model_validate(row) for row in executions],
            deferred_values=[DeferredFieldValueOut.model_validate(row) for row in deferred],
        )

    async def start_execution(
        self,
        enrollment_id: UUID,
        execution_id: UUID,
        *,
        tenant_id: UUID,
        now: datetime,
    ) -> PathwayBlockExecution:
        row = await self._repo.get_execution(execution_id, enrollment_id, tenant_id)
        if row is None:
            raise BlockExecutionNotFoundError()
        domain = _row_to_domain_execution(row)
        try:
            RuntimeEngine.start(domain, now=now)
        except InvalidTransitionError as exc:
            raise InvalidExecutionResultError(
                field=f"executions[{execution_id}].state",
                reason=str(exc),
            ) from exc
        _apply_domain(row, domain)
        await self._repo._session.flush()  # noqa: SLF001
        return row

    async def complete_execution(
        self,
        enrollment_id: UUID,
        execution_id: UUID,
        *,
        result: dict | None,
        tenant_id: UUID,
        now: datetime,
    ) -> PathwayBlockExecution:
        enrollment = await self._repo.get(enrollment_id, tenant_id)
        if enrollment is None:
            raise EnrollmentNotFoundError()
        children = await self._pathway_repo.fetch_children(enrollment.pathway_version_id)
        templates: dict[UUID, BaseBlock] = {
            row.id: block_row_to_domain(row) for row in children.blocks
        }
        executions = await self._load_executions(enrollment_id)
        if execution_id not in executions:
            raise BlockExecutionNotFoundError()

        # §6.2 RESULT_TYPE validation: when the block subclass
        # declares a typed result schema, the supplied `result` must
        # parse against it. Subclasses without a RESULT_TYPE
        # (catalogue-default `None`) accept any dict payload — the
        # check stays opt-in so older kinds don't suddenly 422.
        template = templates.get(executions[execution_id].block_template_id)
        if template is not None and template.RESULT_TYPE is not None:
            try:
                template.RESULT_TYPE.model_validate(result or {})  # type: ignore[attr-defined]
            except Exception as exc:
                raise InvalidExecutionResultError(
                    field=f"executions[{execution_id}].result",
                    reason=str(exc),
                ) from exc

        try:
            RuntimeEngine.complete(executions, templates, execution_id, result=result, now=now)
        except InvalidTransitionError as exc:
            # Engine internals leak through as 500s otherwise; reshape
            # to the documented 422 surface.
            raise InvalidExecutionResultError(
                field=f"executions[{execution_id}].state",
                reason=str(exc),
            ) from exc
        # Catalogue-expansion § 2: completing the first reachable
        # EndPathwayBlock flips the enrollment terminal. Idempotent —
        # subsequent end completions on an already-`completed`
        # enrollment leave the state untouched. Mutating the tracked
        # ORM row is sufficient; the session commit persists it.
        if isinstance(template, EndPathwayBlock) and enrollment.state == "active":
            enrollment.state = "completed"
        # Fire any system/auto blocks (message / external_program) that just
        # became eligible from this completion so the runtime doesn't stall,
        # plus a reachable `end_pathway` block — which terminates the run.
        end_fired = _settle_auto_fire(executions, templates, now=now)
        if end_fired and enrollment.state == "active":
            enrollment.state = "completed"
        await self._save_executions(enrollment_id, executions)
        return await self._repo.get_execution(execution_id, enrollment_id, tenant_id)  # type: ignore[return-value]

    async def read_execution(
        self,
        enrollment_id: UUID,
        execution_id: UUID,
        *,
        tenant_id: UUID,
    ) -> PathwayBlockExecution:
        """Fetch one execution row (used by the temporal-mode endpoints to
        re-read the projection after an Update settles)."""
        row = await self._repo.get_execution(execution_id, enrollment_id, tenant_id)
        if row is None:
            raise BlockExecutionNotFoundError()
        return row

    async def complete_step(
        self,
        enrollment_id: UUID,
        execution_id: UUID,
        *,
        result: dict | None,
        tenant_id: UUID,
        now: datetime,
    ) -> PathwayBlockExecution:
        """Start-if-needed then complete — the single caregiver action.

        The runtime requires `eligible → active → completed`, so an
        eligible step is started first. Mirrors the orchestrator tab's
        two-step flow and is what the Temporal `complete` Update calls.
        """
        row = await self._repo.get_execution(execution_id, enrollment_id, tenant_id)
        if row is None:
            raise BlockExecutionNotFoundError()
        if row.state == "eligible":
            await self.start_execution(enrollment_id, execution_id, tenant_id=tenant_id, now=now)
        return await self.complete_execution(
            enrollment_id,
            execution_id,
            result=result,
            tenant_id=tenant_id,
            now=now,
        )

    async def patch_deferred_value(
        self,
        enrollment_id: UUID,
        attr: str,
        patch: DeferredFieldValuePatch,
        *,
        tenant_id: UUID,
    ) -> PathwayDeferredFieldValue:
        """Late-supply (or correct) a deferred field value + re-run eligibility.

        The schema contract advertises automatic re-evaluation —
        clients send the PATCH and expect previously-pending blocks
        to surface as `eligible` if the supplied value unblocks them.
        Without the eligibility pass the runtime view stays stale
        until the next unrelated `complete` call.
        """
        # Ensure the enrollment itself is visible to the caller so a
        # PATCH never crosses tenant boundaries.
        enrollment = await self._repo.get(enrollment_id, tenant_id)
        if enrollment is None:
            raise EnrollmentNotFoundError()

        existing = await self._repo.get_deferred_value(enrollment_id, patch.block_template_id, attr)
        now = datetime.now(UTC)
        if existing is not None:
            existing.value_json = patch.value_json
            existing.set_at = now
            row = existing
        else:
            row = PathwayDeferredFieldValue(
                id=uuid4(),
                enrollment_id=enrollment_id,
                block_template_id=patch.block_template_id,
                attr=attr,
                value_json=patch.value_json,
                set_at=now,
            )
            self._repo._session.add(row)  # noqa: SLF001
        await self._repo._session.flush()  # noqa: SLF001

        # Re-run eligibility so any block whose `input_logic` now
        # resolves to true on the supplied value transitions.
        children = await self._pathway_repo.fetch_children(enrollment.pathway_version_id)
        templates: dict[UUID, BaseBlock] = {
            block_row.id: block_row_to_domain(block_row) for block_row in children.blocks
        }
        await self._run_eligibility(enrollment, templates)
        return row

    # ---- internals ---------------------------------------------------------

    async def _assert_patient_in_tenant(
        self,
        patient_id: UUID,
        tenant_id: UUID,
    ) -> None:
        """Reject `payload.patient_id` from a different tenant.

        Mirrors the cross-tenant guard the existing pathway service
        applies to its FKs. The patients table is tenant-owned, so
        any row visible inside this tenant has matching `tenant_id`.
        """
        stmt = select(Patient.id).where(
            Patient.id == patient_id,
            Patient.tenant_id == tenant_id,
            Patient.deleted_at.is_(None),
        )
        row = (await self._repo._session.execute(stmt)).scalar_one_or_none()  # noqa: SLF001
        if row is None:
            raise CrossTenantReferenceError(
                field="patient_id",
                reason=f"patient {patient_id} not visible to caller's tenant",
            )

    async def _assert_pathway_version_in_tenant(
        self,
        pathway_version_id: UUID,
        tenant_id: UUID,
    ) -> None:
        """Reject `payload.pathway_version_id` from a different tenant.

        `pathway_version` itself is tenant-scoped via its parent
        `pathway`, so the join is what enforces the boundary.
        """
        stmt = (
            select(PathwayVersion.id)
            .join(Pathway, Pathway.id == PathwayVersion.pathway_id)
            .where(
                PathwayVersion.id == pathway_version_id,
                Pathway.tenant_id == tenant_id,
                PathwayVersion.deleted_at.is_(None),
                Pathway.deleted_at.is_(None),
            )
        )
        row = (await self._repo._session.execute(stmt)).scalar_one_or_none()  # noqa: SLF001
        if row is None:
            raise CrossTenantReferenceError(
                field="pathway_version_id",
                reason=(f"pathway_version {pathway_version_id} not visible to caller's tenant"),
            )

    async def _run_eligibility(
        self,
        enrollment: PathwayEnrollment,
        templates: dict[UUID, BaseBlock],
        *,
        now: datetime | None = None,
    ) -> None:
        executions = await self._load_executions(enrollment.id)
        now = now or datetime.now(UTC)
        # Catalogue-expansion § 1: `StartBlock` executions skip the
        # `pending`/`eligible` states and land directly at `completed`
        # so the eligibility pass below sees them as `done` and fires
        # downstream `if_done(start)` rules in the same loop.
        RuntimeEngine.auto_fire_starts(executions, templates, now=now)
        RuntimeEngine.evaluate_eligibility(executions, templates, now=now)
        end_fired = _settle_auto_fire(executions, templates, now=now)
        if end_fired and enrollment.state == "active":
            enrollment.state = "completed"
        await self._save_executions(enrollment.id, executions)

    async def _load_executions(self, enrollment_id: UUID) -> dict[UUID, BlockExecution]:
        rows = await self._repo.list_executions(enrollment_id)
        return {row.id: _row_to_domain_execution(row) for row in rows}

    async def _save_executions(
        self,
        enrollment_id: UUID,
        domain: dict[UUID, BlockExecution],
    ) -> None:
        rows = {row.id: row for row in await self._repo.list_executions(enrollment_id)}
        for exec_id, exec_domain in domain.items():
            row = rows.get(exec_id)
            if row is None:
                continue
            _apply_domain(row, exec_domain)
        await self._repo._session.flush()  # noqa: SLF001


_AUTO_FIRE_KINDS: frozenset[str] = frozenset({"message", "external_program"})


def _next_auto_wake(
    executions: dict[UUID, BlockExecution],
    templates: dict[UUID, BaseBlock],
    *,
    now: datetime,
) -> datetime | None:
    """Earliest future `scheduled_at` of a still-eligible auto block.

    These are the blocks `auto_fire_system` deferred because their
    timing had not elapsed — the workflow sleeps until the soonest one
    so it can fire on schedule.
    """
    candidates = [
        execution.scheduled_at
        for execution in executions.values()
        if execution.state == "eligible"
        and execution.scheduled_at is not None
        and execution.scheduled_at > now
        and (template := templates.get(execution.block_template_id)) is not None
        and template.KIND in _AUTO_FIRE_KINDS
    ]
    return min(candidates) if candidates else None


def _settle_auto_fire(
    executions: dict[UUID, BlockExecution],
    templates: dict[UUID, BaseBlock],
    *,
    now: datetime,
) -> bool:
    """Fire system/auto + `end_pathway` blocks to a fixpoint.

    Auto-firing a `message` / `external_program` block can make its
    downstream eligible, which may itself be an auto block — so we
    alternate firing + `evaluate_eligibility` until nothing more
    fires. Bounded by the number of executions (each block fires at
    most once).

    Returns `True` when an `end_pathway` block completed, so the
    caller can flip the enrollment to `completed`.
    """
    end_fired = False
    for _ in range(len(executions) + 1):
        fired = RuntimeEngine.auto_fire_system(executions, templates, now=now)
        ended = RuntimeEngine.auto_fire_end(executions, templates, now=now)
        if ended:
            end_fired = True
        if not fired and not ended:
            return end_fired
        RuntimeEngine.evaluate_eligibility(executions, templates, now=now)
    return end_fired


def _picked_scheduled_at(
    template: BaseBlock,
    template_id: UUID,
    supplied: dict[tuple[UUID, str], object],
) -> datetime | None:
    """Mirror a supplied `at_enrollment_picked_date` deferred value onto `scheduled_at`.

    Looks up the deferred-field spec on the block subclass whose
    `kind == "date"` (the canonical kind for picked-date inputs);
    falls back to the first deferred spec when no date-kind entry
    exists. The supplied value is parsed as an ISO 8601 date / datetime
    string. Returns `None` when no candidate value is present (the
    publish gate guarantees at least one will be when the policy is
    in use).
    """
    candidate_attr: str | None = None
    for spec in template.DEFERRED_FIELDS:
        if spec.kind == "date" or candidate_attr is None:
            candidate_attr = spec.attr
            if spec.kind == "date":
                break
    if candidate_attr is None:
        return None
    raw = supplied.get((template_id, candidate_attr))
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo is not None else raw.replace(tzinfo=UTC)
    if isinstance(raw, str):
        try:
            parsed = datetime.fromisoformat(raw)
        except ValueError:
            return None
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
    return None


def _row_to_domain_execution(row: PathwayBlockExecution) -> BlockExecution:
    return BlockExecution(
        id=row.id,
        enrollment_id=row.enrollment_id,
        block_template_id=row.block_template_id,
        scheduled_at=row.scheduled_at,
        started_at=row.started_at,
        completed_at=row.completed_at,
        due_at=row.due_at,
        state=row.state,  # type: ignore[arg-type]
        result_json=row.result_json,
        decision_output=row.decision_output,
    )


def _apply_domain(row: PathwayBlockExecution, domain: BlockExecution) -> None:
    row.scheduled_at = domain.scheduled_at
    row.started_at = domain.started_at
    row.completed_at = domain.completed_at
    row.due_at = domain.due_at
    row.state = domain.state
    row.result_json = domain.result_json
    row.decision_output = domain.decision_output


__all__ = [
    "BlockExecutionNotFoundError",
    "DeferredFieldMissingError",
    "EnrollmentNotFoundError",
    "EnrollmentService",
]
