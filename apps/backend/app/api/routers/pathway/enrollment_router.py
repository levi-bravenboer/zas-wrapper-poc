"""Enrollment + runtime API surface (chain slot #3 §5)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.core.enums.user import Role
from app.core.errors import ErrorResponse
from app.core.settings import SettingsDep
from app.db.engine import SessionDep
from app.db.models.pathway import PathwayEnrollment
from app.db.models.pathway.version import PathwayVersion
from app.repositories.pathway.deps import EnrollmentRepoDep
from app.schemas.auth.auth import SessionUser
from app.schemas.pathway.enrollment import (
    BlockExecutionResponse,
    DeferredFieldValueOut,
    DeferredFieldValuePatch,
    EnrollmentCreate,
    EnrollmentResponse,
    ExecutionCompleteRequest,
)
from app.services.access.identity.deps import CurrentUserDep, require_role
from app.services.access.permissions.deps import (
    KetoClientDep,
    PatientRelation,
    require_carepath_access,
)
from app.services.care_team.deps import CareTeamServiceDep
from app.services.patient.deps import (
    PatientServiceDep,
    resolve_patient_with_relation,
)
from app.services.pathway.deps import EnrollmentServiceDep
from app.services.pathway.errors import (
    EnrollmentNotFoundError,
    PathwayNotFoundError,
)

router = APIRouter(prefix="/enrollments", tags=["enrollments"])

_ERRORS_404: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
_ERRORS_422: dict[int | str, dict[str, Any]] = {422: {"model": ErrorResponse}}

# Role tuple shared by every enrollment route's `require_role` gate and
# by `require_carepath_access`'s own gate — keep them in lock-step so a
# future role-set change doesn't drift between the route-level dep and
# the inline call to `require_carepath_access` below.
_ENROLLMENT_ROLES: tuple[Role, ...] = (Role.ADMIN, Role.CAREGIVER)


# AUTH-HARDEN (chain slot #3 §5): patient verb + carepath scope on every
# enrollment-keyed route. Resolves `patient_id` + `pathway_id` from the
# enrollment row, then delegates to the same Keto-graduated helpers used
# by `require_patient_relation` / `require_carepath_access`. Denial =>
# 404 (mirrors the existence-hiding contract — see permissions/deps.py).
def _require_enrollment_access(
    relation: PatientRelation,
) -> Callable[..., Awaitable[PathwayEnrollment]]:
    async def _inner(
        enrollment_id: UUID,
        repo: EnrollmentRepoDep,
        patient_service: PatientServiceDep,
        care_team_service: CareTeamServiceDep,
        session: SessionDep,
        settings: SettingsDep,
        keto: KetoClientDep,
        current_user: SessionUser = Depends(require_role(*_ENROLLMENT_ROLES)),
    ) -> PathwayEnrollment:
        enrollment = await repo.get(enrollment_id, tenant_id=current_user.tenant_id)
        if enrollment is None:
            raise EnrollmentNotFoundError()
        await resolve_patient_with_relation(
            enrollment.patient_id,
            patient_service,
            care_team_service,
            session,
            settings,
            keto,
            current_user,
            relation=relation,
        )
        pathway_id = await session.scalar(
            select(PathwayVersion.pathway_id).where(
                PathwayVersion.id == enrollment.pathway_version_id,
            )
        )
        if pathway_id is None:
            # Enrollment.pathway_version_id is a tenant-owned FK; a missing
            # version means the row was soft-deleted out from under the
            # enrollment. Refuse the call rather than silently skipping
            # carepath scope.
            raise PathwayNotFoundError()
        # NOTE: `require_carepath_access` enforces its own role gate via a
        # `require_role(ADMIN, CAREGIVER)` Depends default — only triggered
        # when used as a Depends. Calling it directly we rely on the
        # `_ENROLLMENT_ROLES` gate above; the module-level tuple keeps the
        # two role sets in lock-step.
        await require_carepath_access(pathway_id, session, settings, keto, current_user)
        return enrollment

    return _inner


_REQUIRE_ENROLLMENT_VIEW = Depends(_require_enrollment_access("view"))
_REQUIRE_ENROLLMENT_EDIT = Depends(_require_enrollment_access("edit"))


def _now() -> datetime:
    return datetime.now(UTC)


@router.post(
    "",
    operation_id="create_enrollment",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    responses={**_ERRORS_404, **_ERRORS_422},
)
async def create_enrollment(
    payload: EnrollmentCreate,
    service: EnrollmentServiceDep,
    patient_service: PatientServiceDep,
    care_team_service: CareTeamServiceDep,
    session: SessionDep,
    settings: SettingsDep,
    keto: KetoClientDep,
    current_user: SessionUser = Depends(require_role(*_ENROLLMENT_ROLES)),
) -> EnrollmentResponse:
    # AUTH-HARDEN (slot #3 §5): patient `edit` verb + carepath scope before write.
    # Body-keyed, so the route can't use the path-param `_require_enrollment_access`
    # factory; we delegate to the same Keto-graduated helpers inline.
    await resolve_patient_with_relation(
        payload.patient_id,
        patient_service,
        care_team_service,
        session,
        settings,
        keto,
        current_user,
        relation="edit",
    )
    pathway_id = await session.scalar(
        select(PathwayVersion.pathway_id).where(
            PathwayVersion.id == payload.pathway_version_id,
        )
    )
    if pathway_id is None:
        raise PathwayNotFoundError()
    # NOTE: `require_carepath_access` enforces its own role gate via a Depends
    # default; we rely on the route-level `_ENROLLMENT_ROLES` tuple above to
    # carry the same guarantee for the direct call.
    await require_carepath_access(pathway_id, session, settings, keto, current_user)
    enrollment = await service.create(payload, tenant_id=current_user.tenant_id)
    return await service.get_view(enrollment.id, tenant_id=current_user.tenant_id)


@router.get(
    "",
    operation_id="list_enrollments_by_patient",
    response_model=list[EnrollmentResponse],
    responses=_ERRORS_404,
)
async def list_enrollments_by_patient(
    patient_id: UUID = Query(...),  # noqa: B008
    *,
    service: EnrollmentServiceDep,
    patient_service: PatientServiceDep,
    care_team_service: CareTeamServiceDep,
    session: SessionDep,
    settings: SettingsDep,
    keto: KetoClientDep,
    current_user: SessionUser = Depends(require_role(*_ENROLLMENT_ROLES)),
) -> list[EnrollmentResponse]:
    # AUTH-HARDEN (slot #3 §5): care-team `view` scope on the patient.
    # Query-keyed, so the route resolves the patient relation inline
    # (mirrors `create_enrollment`). No per-pathway carepath gate here —
    # the list spans every pathway the patient is enrolled in.
    await resolve_patient_with_relation(
        patient_id,
        patient_service,
        care_team_service,
        session,
        settings,
        keto,
        current_user,
        relation="view",
    )
    return await service.list_views_by_patient(patient_id, tenant_id=current_user.tenant_id)


@router.get(
    "/{enrollment_id}",
    operation_id="get_enrollment",
    response_model=EnrollmentResponse,
    responses=_ERRORS_404,
    dependencies=[_REQUIRE_ENROLLMENT_VIEW],
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
    dependencies=[_REQUIRE_ENROLLMENT_EDIT],
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
    dependencies=[_REQUIRE_ENROLLMENT_EDIT],
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
    dependencies=[_REQUIRE_ENROLLMENT_EDIT],
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
