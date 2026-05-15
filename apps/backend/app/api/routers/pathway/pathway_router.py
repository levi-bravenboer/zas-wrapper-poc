from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, status

from app.core.errors import ErrorResponse
from app.schemas.pathway import (
    PathwayBlockType,
    PathwayCreate,
    PathwayDefinition,
    PathwayDefinitionReplace,
    PathwayLaneKindRow,
    PathwayPhaseTemplate,
    PathwaySummary,
)
from app.services.auth.deps import CurrentUserDep
from app.services.pathway.deps import PathwayServiceDep

router = APIRouter(prefix="/pathways", tags=["pathways"])

_ERRORS_404: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}
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
    return await service.list_block_types()


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
    "/lane-kinds",
    operation_id="list_pathway_lane_kinds",
    response_model=list[PathwayLaneKindRow],
)
async def list_pathway_lane_kinds(
    _current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> list[PathwayLaneKindRow]:
    return await service.list_lane_kinds()


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
    response_model=PathwayDefinition,
    status_code=status.HTTP_201_CREATED,
    responses=_ERRORS_422,
)
async def create_pathway(
    payload: PathwayCreate,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayDefinition:
    return await service.create_empty(current_user.tenant_id, payload.name)


@router.get(
    "/{pathway_id}",
    operation_id="get_pathway",
    response_model=PathwayDefinition,
    responses=_ERRORS_404,
)
async def get_pathway(
    pathway_id: UUID,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayDefinition:
    return await service.get_definition(pathway_id, current_user.tenant_id)


@router.put(
    "/{pathway_id}",
    operation_id="replace_pathway",
    response_model=PathwayDefinition,
    responses={**_ERRORS_404, **_ERRORS_422},
)
async def replace_pathway(
    pathway_id: UUID,
    payload: PathwayDefinitionReplace,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> PathwayDefinition:
    return await service.replace_definition(pathway_id, current_user.tenant_id, payload)


@router.delete(
    "/{pathway_id}",
    operation_id="delete_pathway",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=_ERRORS_404,
)
async def delete_pathway(
    pathway_id: UUID,
    current_user: CurrentUserDep,
    service: PathwayServiceDep,
) -> None:
    await service.soft_delete(pathway_id, current_user.tenant_id)


__all__ = ["router"]
