"""Enrollment + runtime API surface (chain slot #3 §5)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select

from app.core.enums import Permission
from app.core.errors import ErrorResponse
from app.core.settings import SettingsDep
from app.db.engine import SessionDep
from app.db.models.access.role import Role as RoleModel
from app.db.models.pathway import PathwayEnrollment
from app.db.models.pathway.version import PathwayVersion
from app.db.models.practitioner.practitioner import Practitioner
from app.db.models.practitioner.practitioner_role import PractitionerRole
from app.db.models.user.user import User
from app.repositories.pathway.deps import EnrollmentRepoDep
from app.schemas.auth.auth import SessionUser
from app.schemas.pathway.enrollment import (
    BlockExecutionResponse,
    DeferredFieldValueOut,
    DeferredFieldValuePatch,
    EnrollDescriptor,
    EnrollmentCandidate,
    EnrollmentCreate,
    EnrollmentResponse,
    ExecutionCompleteRequest,
)
from app.services.access.identity.deps import CurrentUserDep
from app.services.access.rbac.deps import require_permission
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
from app.services.pathway.runtime_dispatch import (
    cancel_via_workflow,
    complete_via_workflow,
    notify_via_workflow,
    pause_via_workflow,
    resume_via_workflow,
    start_enrollment_workflow,
)

router = APIRouter(prefix="/enrollments", tags=["enrollments"])

_ERRORS_404: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
_ERRORS_422: dict[int | str, dict[str, Any]] = {422: {"model": ErrorResponse}}

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
        current_user: CurrentUserDep,
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
        # NOTE: `require_carepath_access` enforces its own gate via a Depends
        # default — only triggered when used as a Depends. Calling it directly
        # here, the route is already authenticated (CurrentUserDep) and the
        # carepath + patient-relation checks above carry the access guarantee.
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
    request: Request,
    payload: EnrollmentCreate,
    service: EnrollmentServiceDep,
    patient_service: PatientServiceDep,
    care_team_service: CareTeamServiceDep,
    session: SessionDep,
    settings: SettingsDep,
    keto: KetoClientDep,
    current_user: CurrentUserDep,
) -> EnrollmentResponse:
    # AUTH-HARDEN (slot #3 §5): patient `view` + carepath scope before write.
    # Enrolling is itself the act by which a caregiver takes on a patient, so
    # we don't pre-require care-team `edit` (chicken-and-egg). Instead we gate
    # on `view` + carepath access (the carepath authorises the write), then
    # auto-join the enroller to the care team below so subsequent writes have
    # the `edit` relation. Body-keyed, so we delegate to the Keto-graduated
    # helpers inline rather than the path-param factory.
    await resolve_patient_with_relation(
        payload.patient_id,
        patient_service,
        care_team_service,
        session,
        settings,
        keto,
        current_user,
        relation="view",
    )
    pathway_id = await session.scalar(
        select(PathwayVersion.pathway_id).where(
            PathwayVersion.id == payload.pathway_version_id,
        )
    )
    if pathway_id is None:
        raise PathwayNotFoundError()
    # NOTE: `require_carepath_access` enforces its own gate via a Depends
    # default; called directly here the authenticated caller + the carepath
    # check itself carry the access guarantee.
    await require_carepath_access(pathway_id, session, settings, keto, current_user)
    # Auto-join: enrolling makes the caregiver a care-team member so the
    # enrollment's downstream writes (complete step, materialise appointment)
    # satisfy the `edit` relation.
    await care_team_service.ensure_membership(current_user, payload.patient_id)
    enrollment = await service.create(payload, tenant_id=current_user.tenant_id)
    view = await service.get_view(enrollment.id, tenant_id=current_user.tenant_id)
    if settings.pathway_runtime_engine == "temporal":
        # Commit the freshly-created rows so the worker's activities (separate
        # sessions) can see them, then hand the enrollment to its workflow.
        await session.commit()
        await start_enrollment_workflow(
            request.app,
            enrollment_id=enrollment.id,
            actor=current_user,
            task_queue=settings.temporal_task_queue,
        )
    return view


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
    current_user: CurrentUserDep,
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
    "/descriptor",
    operation_id="get_enroll_descriptor",
    response_model=EnrollDescriptor,
    responses={**_ERRORS_404, **_ERRORS_422},
)
async def get_enroll_descriptor(
    pathway_version_id: UUID = Query(...),  # noqa: B008
    *,
    service: EnrollmentServiceDep,
    session: SessionDep,
    settings: SettingsDep,
    keto: KetoClientDep,
    current_user: CurrentUserDep,
) -> EnrollDescriptor:
    # Carepath scope on the version's pathway — same gate as create.
    pathway_id = await session.scalar(
        select(PathwayVersion.pathway_id).where(PathwayVersion.id == pathway_version_id)
    )
    if pathway_id is None:
        raise PathwayNotFoundError()
    await require_carepath_access(pathway_id, session, settings, keto, current_user)
    return await service.enroll_descriptor(pathway_version_id, tenant_id=current_user.tenant_id)


@router.get(
    "/candidates",
    operation_id="list_enrollment_candidates",
    response_model=list[EnrollmentCandidate],
)
async def list_enrollment_candidates(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> list[EnrollmentCandidate]:
    # Assignable users for participant slots: active, non-patient users in the
    # caller's tenant. Caregiver-accessible (unlike admin-only `/users`). The
    # left-join carries each user's open practitioner role + specialty so the
    # dialog can scope each dropdown to the block's required role/specialty.
    rows = (
        await session.execute(
            select(User, PractitionerRole.code, PractitionerRole.specialty, RoleModel.slug)
            .join(RoleModel, RoleModel.id == User.role_id)
            .join(Practitioner, Practitioner.user_id == User.id, isouter=True)
            .join(
                PractitionerRole,
                (PractitionerRole.practitioner_id == Practitioner.id)
                & PractitionerRole.period_end.is_(None),
                isouter=True,
            )
            .where(
                User.tenant_id == current_user.tenant_id,
                User.is_active.is_(True),
                User.patient_id.is_(None),
            )
            .order_by(User.display_name)
        )
    ).all()
    seen: set[tuple[UUID, str | None, str | None]] = set()
    out: list[EnrollmentCandidate] = []
    for user, code, specialty, role_slug in rows:
        role_code = code.value if code is not None else None
        key = (user.id, role_code, specialty)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            EnrollmentCandidate(
                id=user.id,
                display_name=user.display_name,
                role=role_slug,
                practitioner_role=role_code,
                specialty=specialty,
            )
        )
    return out


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
    "/{enrollment_id}:cancel",
    operation_id="cancel_enrollment",
    response_model=EnrollmentResponse,
    responses=_ERRORS_404,
    dependencies=[_REQUIRE_ENROLLMENT_EDIT],
)
async def cancel_enrollment(
    request: Request,
    enrollment_id: UUID,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
    settings: SettingsDep,
) -> EnrollmentResponse:
    view = await service.cancel(enrollment_id, tenant_id=current_user.tenant_id)
    if settings.pathway_runtime_engine == "temporal":
        # Stop the workflow's timer loop; the DB state is already flipped
        # above and the workflow's cancel activity is idempotent.
        await cancel_via_workflow(request.app, enrollment_id=enrollment_id)
    return view


@router.post(
    "/{enrollment_id}:pause",
    operation_id="pause_enrollment",
    response_model=EnrollmentResponse,
    responses=_ERRORS_404,
    dependencies=[_REQUIRE_ENROLLMENT_EDIT],
)
async def pause_enrollment(
    request: Request,
    enrollment_id: UUID,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
    settings: SettingsDep,
) -> EnrollmentResponse:
    view = await service.pause(enrollment_id, tenant_id=current_user.tenant_id)
    if settings.pathway_runtime_engine == "temporal":
        await pause_via_workflow(request.app, enrollment_id=enrollment_id)
    return view


@router.post(
    "/{enrollment_id}:resume",
    operation_id="resume_enrollment",
    response_model=EnrollmentResponse,
    responses=_ERRORS_404,
    dependencies=[_REQUIRE_ENROLLMENT_EDIT],
)
async def resume_enrollment(
    request: Request,
    enrollment_id: UUID,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
    settings: SettingsDep,
) -> EnrollmentResponse:
    view = await service.resume(enrollment_id, tenant_id=current_user.tenant_id, now=_now())
    if settings.pathway_runtime_engine == "temporal":
        await resume_via_workflow(request.app, enrollment_id=enrollment_id)
    return view


@router.post(
    "/{enrollment_id}:fast-forward",
    operation_id="fast_forward_enrollment",
    response_model=EnrollmentResponse,
    responses=_ERRORS_404,
)
async def fast_forward_enrollment(
    enrollment_id: UUID,
    service: EnrollmentServiceDep,
    current_user: SessionUser = Depends(  # AUTH-HARDEN: pathway.manageRuntime
        require_permission(Permission.PATHWAY_MANAGE_RUNTIME)
    ),
) -> EnrollmentResponse:
    # Runtime-management test tool: auto-complete non-choice steps and fire timers
    # until the run ends or hits a decision/MDO needing a manual outcome.
    # Direct service mutation (not workflow-driven) — it advances the DB state
    # so the runtime view reflects the fast-forward immediately.
    await service.fast_forward(
        enrollment_id, tenant_id=current_user.tenant_id, now=_now()
    )
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
    request: Request,
    enrollment_id: UUID,
    execution_id: UUID,
    payload: ExecutionCompleteRequest,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
    settings: SettingsDep,
) -> BlockExecutionResponse:
    if settings.pathway_runtime_engine == "temporal":
        # Route the caregiver action through the workflow Update so durable
        # timers + downstream eligibility settle inside the workflow, then
        # re-read the committed projection for the response.
        await complete_via_workflow(
            request.app,
            enrollment_id=enrollment_id,
            execution_id=execution_id,
            result=payload.result,
        )
        row = await service.read_execution(
            enrollment_id, execution_id, tenant_id=current_user.tenant_id
        )
        return BlockExecutionResponse.model_validate(row)
    row = await service.complete_execution(
        enrollment_id,
        execution_id,
        result=payload.result,
        tenant_id=current_user.tenant_id,
        now=_now(),
    )
    # §6.4: record who completed the step.
    await service.stamp_completion(enrollment_id, execution_id, actor=current_user)
    # §3.5: materialise a real Appointment for appointment/treatment steps.
    await service.materialize_appointment(enrollment_id, execution_id, actor=current_user)
    row = await service.read_execution(
        enrollment_id, execution_id, tenant_id=current_user.tenant_id
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
    request: Request,
    enrollment_id: UUID,
    attr: str,
    payload: DeferredFieldValuePatch,
    current_user: CurrentUserDep,
    service: EnrollmentServiceDep,
    settings: SettingsDep,
) -> DeferredFieldValueOut:
    row = await service.patch_deferred_value(
        enrollment_id,
        attr,
        payload,
        tenant_id=current_user.tenant_id,
    )
    if settings.pathway_runtime_engine == "temporal":
        # Recomputed timers (e.g. moved clinical date) — wake the workflow so
        # it re-evaluates its next durable timer against the new schedule.
        await notify_via_workflow(request.app, enrollment_id=enrollment_id)
    return DeferredFieldValueOut.model_validate(row)


__all__ = ["router"]
