"""Enrollment service — owns runtime-aggregate creation + state transitions.

Composition: loads template blocks via the slot-#1/§2 mapper, derives
each `BlockExecution.scheduled_at` via the slot-#2 `TimingPolicy`
through the §3 scheduling helper, persists, then hands the in-memory
aggregate back to the runtime engine for the initial eligibility pass.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from app.core.errors import AppError
from app.db.models.pathway import (
    PathwayBlockExecution,
    PathwayDeferredFieldValue,
    PathwayEnrollment,
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
        values are rejected before any row is inserted.
        """
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

        session = self._repo._session  # noqa: SLF001
        enrollment = PathwayEnrollment(
            id=uuid4(),
            tenant_id=tenant_id,
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
                    tenant_id=tenant_id,
                    enrollment_id=enrollment.id,
                    block_template_id=v.block_template_id,
                    attr=v.attr,
                    value_json=v.value_json,
                )
            )

        # Compute each execution's schedule + due slots from the
        # block's `TimingPolicy` and the enrollment anchor.
        for template_id, template in templates.items():
            timing_policy = (
                template.timing_policy.model_dump(mode="json")
                if template.timing_policy is not None
                else None
            )
            scheduled_at, due_at = schedule_from_anchor(
                payload.anchor_date, timing_policy
            )
            session.add(
                PathwayBlockExecution(
                    id=uuid4(),
                    tenant_id=tenant_id,
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
        existing = await self._repo.get_deferred_value(
            enrollment_id, patch.block_template_id, attr
        )
        if existing is not None:
            existing.value_json = patch.value_json
            await self._repo._session.flush()  # noqa: SLF001
            return existing
        row = PathwayDeferredFieldValue(
            id=uuid4(),
            tenant_id=tenant_id,
            enrollment_id=enrollment_id,
            block_template_id=patch.block_template_id,
            attr=attr,
            value_json=patch.value_json,
        )
        self._repo._session.add(row)  # noqa: SLF001
        await self._repo._session.flush()  # noqa: SLF001
        return row

    # ---- internals ---------------------------------------------------------

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
