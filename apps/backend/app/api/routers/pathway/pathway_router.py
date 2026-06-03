from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, status

from app.core.errors import ErrorResponse
from app.schemas.pathway import (
    PathwayBlockType,
    PathwayChildSummary,
    PathwayCreate,
    PathwayDefinitionReplace,
    PathwayEdgeOffsetDirection,
    PathwayEdgeTimingKind,
    PathwayParentReference,
    PathwayPhaseTemplate,
    PathwayPublishRequest,
    PathwaySummary,
    PathwayVersionDefinition,
    PathwayVersionSummary,
    PathwayWithVersionResponse,
)
from app.services.auth.deps import CurrentUserDep
from app.services.pathway.deps import PathwayServiceDep, PathwayVersionServiceDep

router = APIRouter(prefix="/pathways", tags=["pathways"])

_ERRORS_404: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
_ERRORS_409: dict[int | str, dict[str, Any]] = {409: {"model": ErrorResponse}}
_ERRORS_422: dict[int | str, dict[str, Any]] = {422: {"model": ErrorResponse}}


@router.get(
    "/blocks",
    operation_id="list_pathway_block_types",
    response_model=list[PathwayBlockType],
)
async def list_pathway_block_types(
    _current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> list[PathwayBlockType]:
    return service.list_block_types()


@router.get(
    "/phase-templates",
    operation_id="list_pathway_phase_templates",
    response_model=list[PathwayPhaseTemplate],
)
async def list_pathway_phase_templates(
    _current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> list[PathwayPhaseTemplate]:
    return service.list_phase_templates()


@router.get(
    "/edge-timing-kinds",
    operation_id="list_pathway_edge_timing_kinds",
    response_model=list[PathwayEdgeTimingKind],
)
async def list_pathway_edge_timing_kinds(
    _current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> list[PathwayEdgeTimingKind]:
    return service.list_edge_timing_kinds()


@router.get(
    "/edge-offset-directions",
    operation_id="list_pathway_edge_offset_directions",
    response_model=list[PathwayEdgeOffsetDirection],
)
async def list_pathway_edge_offset_directions(
    _current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> list[PathwayEdgeOffsetDirection]:
    return service.list_edge_offset_directions()


@router.get(
    "",
    operation_id="list_pathways",
    response_model=list[PathwaySummary],
)
async def list_pathways(
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> list[PathwaySummary]:
    return await service.list_summaries(current_user.tenant_id)


@router.post(
    "",
    operation_id="create_pathway",
    response_model=PathwayWithVersionResponse,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS_422,
)
async def create_pathway(
    payload: PathwayCreate,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayWithVersionResponse:
    return await service.create_empty(
        current_user.tenant_id,
        payload.name,
        clinical_goal=payload.clinical_goal,
        patient_goal=payload.patient_goal,
    )


@router.get(
    "/{pathway_id}/parent-references",
    operation_id="list_pathway_parent_references",
    response_model=list[PathwayParentReference],
    responses=_ERRORS_404,
)
async def list_pathway_parent_references(
    pathway_id: UUID,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> list[PathwayParentReference]:
    # Pre-check for the delete-confirmation modal. If the returned list is
    # non-empty, the pathway is used as a sub-pathway by other pathways and
    # cannot be deleted until those references are removed.
    return await service.list_parent_references(pathway_id, current_user.tenant_id)


@router.get(
    "/{pathway_id}/summary",
    operation_id="get_pathway_summary",
    response_model=PathwayChildSummary,
    responses=_ERRORS_404,
)
async def get_pathway_summary(
    pathway_id: UUID,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayChildSummary:
    # Read-only summary driving the nested-pathway inspector preview in the
    # parent canvas. Counts come from the pathway's preferred version (latest
    # published if any, else concept) so the parent reflects what its
    # `pathway_link` block would actually resolve to.
    return await service.get_child_summary(pathway_id, current_user.tenant_id)


@router.get(
    "/{pathway_id}",
    operation_id="get_pathway",
    response_model=PathwayWithVersionResponse,
    responses=_ERRORS_404,
)
async def get_pathway(
    pathway_id: UUID,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayWithVersionResponse:
    return await service.get_with_resolved_version(pathway_id, current_user.tenant_id)


@router.put(
    "/{pathway_id}",
    operation_id="replace_pathway",
    response_model=PathwayWithVersionResponse,
    responses={**_ERRORS_404, **_ERRORS_409, **_ERRORS_422},
)
async def replace_pathway(
    pathway_id: UUID,
    payload: PathwayDefinitionReplace,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayWithVersionResponse:
    return await service.replace_definition(pathway_id, current_user.tenant_id, payload)


@router.delete(
    "/{pathway_id}",
    operation_id="delete_pathway",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**_ERRORS_404, **_ERRORS_409},
)
async def delete_pathway(
    pathway_id: UUID,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> None:
    await service.soft_delete(pathway_id, current_user.tenant_id)


# ---- Version lifecycle ----------------------------------------------------


@router.get(
    "/{pathway_id}/versions",
    operation_id="list_pathway_versions",
    response_model=list[PathwayVersionSummary],
    responses=_ERRORS_404,
)
async def list_pathway_versions(
    pathway_id: UUID,
    current_user: CurrentUserDep,
    version_service: PathwayVersionServiceDep,
) -> list[PathwayVersionSummary]:
    return await version_service.list_versions(pathway_id, current_user.tenant_id)


@router.get(
    "/{pathway_id}/versions/{version_id}",
    operation_id="get_pathway_version",
    response_model=PathwayVersionDefinition,
    responses=_ERRORS_404,
)
async def get_pathway_version(
    pathway_id: UUID,
    version_id: UUID,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayVersionDefinition:
    return await service.get_version_definition(pathway_id, version_id, current_user.tenant_id)


@router.post(
    "/{pathway_id}/publish",
    operation_id="publish_pathway",
    response_model=PathwayVersionSummary,
    responses={**_ERRORS_404, **_ERRORS_409, **_ERRORS_422},
)
async def publish_pathway(
    pathway_id: UUID,
    payload: PathwayPublishRequest,
    current_user: CurrentUserDep,
    version_service: PathwayVersionServiceDep,
) -> PathwayVersionSummary:
    return await version_service.publish(
        pathway_id, current_user.tenant_id, payload, current_user.id
    )


@router.post(
    "/{pathway_id}/versions/{version_id}/restore",
    operation_id="restore_pathway_version",
    response_model=PathwayVersionSummary,
    status_code=status.HTTP_201_CREATED,
    responses={**_ERRORS_404, **_ERRORS_409},
)
async def restore_pathway_version(
    pathway_id: UUID,
    version_id: UUID,
    current_user: CurrentUserDep,
    version_service: PathwayVersionServiceDep,
) -> PathwayVersionSummary:
    return await version_service.restore(pathway_id, version_id, current_user.tenant_id)


@router.post(
    "/{pathway_id}/versions/{version_id}/fork-from-publish",
    operation_id="fork_pathway_from_publish",
    response_model=PathwayVersionSummary,
    status_code=status.HTTP_201_CREATED,
    responses={**_ERRORS_404, **_ERRORS_409, **_ERRORS_422},
)
async def fork_pathway_from_publish(
    pathway_id: UUID,
    version_id: UUID,
    current_user: CurrentUserDep,
    version_service: PathwayVersionServiceDep,
) -> PathwayVersionSummary:
    return await version_service.fork_from_publish(pathway_id, version_id, current_user.tenant_id)


__all__ = ["router"]
