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

from app.core.errors import AppError
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
from app.domain.pathway.runtime.execution import BlockExecution
from app.domain.pathway.runtime.scheduling import schedule_from_anchor
from app.repositories.pathway.enrollment_repository import EnrollmentRepository
from app.repositories.pathway.pathway_repository import PathwayRepository
from app.schemas.pathway.enrollment import (
    EnrollmentCreate,
    DeferredFieldValuePatch,
)
from app.services.pathway.runtime.engine import RuntimeEngine


class EnrollmentNotFoundError(AppError):
    code = "not-found.enrollment.unknown"
    status_code = 404
    message = "Enrollment not found."


class BlockExecutionNotFoundError(AppError):
    code = "not-found.block-execution.unknown"
    status_code = 404
    message = "Block execution not found."


class DeferredFieldMissingError(AppError):
    code = "invalid.enrollment.deferred-field-missing"
    status_code = 422
    message = "Enrollment missing a required deferred field value."


class CrossTenantReferenceError(AppError):
    code = "invalid.enrollment.cross-tenant-reference"
    status_code = 422
    message = "Enrollment references an entity outside the caller's tenant."

    def __init__(self, *, field: str, reason: str) -> None:
        super().__init__(
            message=self.message,
            details={"field": field, "reason": reason},
        )


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
        # Cross-tenant guard: confirm the patient + pathway version
        # both belong to the caller's tenant before persisting any
        # row. The FK columns are already tenant-owned, but enforcing
        # at the service layer keeps the response shaped as a 422 (not
        # a foreign-key 500 a few flushes later).
        await self._assert_patient_in_tenant(payload.patient_id, tenant_id)
        await self._assert_pathway_version_in_tenant(
            payload.pathway_version_id, tenant_id
        )

        children = await self._pathway_repo.fetch_children(payload.pathway_version_id)
        templates: dict[UUID, BaseBlock] = {
            row.id: block_row_to_domain(row) for row in children.blocks
        }

        supplied: dict[tuple[UUID, str], object] = {
            (v.block_template_id, v.attr): v.value_json
            for v in payload.deferred_values
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
            scheduled_at, due_at = schedule_from_anchor(
                payload.anchor_date, timing_policy
            )
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
        await self._run_eligibility(enrollment.id, templates)

        return enrollment

    async def get(self, enrollment_id: UUID, *, tenant_id: UUID) -> PathwayEnrollment:
        row = await self._repo.get(enrollment_id, tenant_id)
        if row is None:
            raise EnrollmentNotFoundError()
        return row

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
        RuntimeEngine.start(domain, now=now)
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
        RuntimeEngine.complete(
            executions, templates, execution_id, result=result, now=now
        )
        await self._save_executions(enrollment_id, executions)
        return await self._repo.get_execution(execution_id, enrollment_id, tenant_id)  # type: ignore[return-value]

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

        existing = await self._repo.get_deferred_value(
            enrollment_id, patch.block_template_id, attr
        )
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
        children = await self._pathway_repo.fetch_children(
            enrollment.pathway_version_id
        )
        templates: dict[UUID, BaseBlock] = {
            block_row.id: block_row_to_domain(block_row) for block_row in children.blocks
        }
        await self._run_eligibility(enrollment_id, templates)
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
                reason=(
                    f"pathway_version {pathway_version_id} not visible "
                    "to caller's tenant"
                ),
            )

    async def _run_eligibility(
        self,
        enrollment_id: UUID,
        templates: dict[UUID, BaseBlock],
    ) -> None:
        executions = await self._load_executions(enrollment_id)
        RuntimeEngine.evaluate_eligibility(executions, templates)
        await self._save_executions(enrollment_id, executions)

    async def _load_executions(
        self, enrollment_id: UUID
    ) -> dict[UUID, BlockExecution]:
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
