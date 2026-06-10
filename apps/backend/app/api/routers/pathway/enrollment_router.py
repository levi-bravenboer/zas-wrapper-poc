"""Enrollment + runtime API surface (chain slot #3 §5)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, status

from app.core.errors import ErrorResponse
from app.services.access.identity.deps import CurrentUserDep
from app.services.pathway.deps import EnrollmentServiceDep
from app.schemas.pathway.enrollment import (
    BlockExecutionResponse,
    DeferredFieldValueOut,
    DeferredFieldValuePatch,
    EnrollmentCreate,
    EnrollmentResponse,
    ExecutionCompleteRequest,
)
# `EnrollmentService` type-only import for argument annotations — the
# router never instantiates it directly; the DI factory handles that
# via `EnrollmentServiceDep`.


router = APIRouter(prefix="/enrollments", tags=["enrollments"])

_ERRORS_404: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
_ERRORS_422: dict[int | str, dict[str, Any]] = {422: {"model": ErrorResponse}}


def _now() -> datetime:
    return datetime.now(UTC)


@router.post(
    "",
    operation_id="create_enrollment",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS_422,
)
async def create_enrollment(
    payload: EnrollmentCreate,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
) -> EnrollmentResponse:
    enrollment = await service.create(payload, tenant_id=current_user.tenant_id)
    return await service.get_view(enrollment.id, tenant_id=current_user.tenant_id)


@router.get(
    "/{enrollment_id}",
    operation_id="get_enrollment",
    response_model=EnrollmentResponse,
    responses=_ERRORS_404,
)
async def get_enrollment(
    enrollment_id: UUID,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
) -> EnrollmentResponse:
    return await service.get_view(enrollment_id, tenant_id=current_user.tenant_id)


@router.post(
    "/{enrollment_id}/executions/{execution_id}:start",
    operation_id="start_block_execution",
    response_model=BlockExecutionResponse,
    responses={**_ERRORS_404, **_ERRORS_422},
)
async def start_block_execution(
    enrollment_id: UUID,
    execution_id: UUID,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
) -> BlockExecutionResponse:
    row = await service.start_execution(
        enrollment_id,
        execution_id,
        tenant_id=current_user.tenant_id,
        now=_now(),
    )
    return BlockExecutionResponse.model_validate(row)


@router.post(
    "/{enrollment_id}/executions/{execution_id}:complete",
    operation_id="complete_block_execution",
    response_model=BlockExecutionResponse,
    responses={**_ERRORS_404, **_ERRORS_422},
)
async def complete_block_execution(
    enrollment_id: UUID,
    execution_id: UUID,
    payload: ExecutionCompleteRequest,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
) -> BlockExecutionResponse:
    row = await service.complete_execution(
        enrollment_id,
        execution_id,
        result=payload.result,
        tenant_id=current_user.tenant_id,
        now=_now(),
    )
    return BlockExecutionResponse.model_validate(row)


@router.patch(
    "/{enrollment_id}/deferred-values/{attr}",
    operation_id="patch_deferred_value",
    response_model=DeferredFieldValueOut,
    responses={**_ERRORS_404, **_ERRORS_422},
)
async def patch_deferred_value(
    enrollment_id: UUID,
    attr: str,
    payload: DeferredFieldValuePatch,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
) -> DeferredFieldValueOut:
    row = await service.patch_deferred_value(
        enrollment_id,
        attr,
        payload,
        tenant_id=current_user.tenant_id,
    )
    return DeferredFieldValueOut.model_validate(row)


__all__ = ["router"]
