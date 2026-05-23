"""Luscii Public-API-style routes.

Per-vendor routes (`/luscii/...`) instead of a generic
`/external-block-providers/...` abstraction. Rationale lives in
`openspec/changes/external-block-integrations/design.md` under
"Per-vendor routes (no cross-vendor Protocol abstraction)".
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.adapters.luscii import LusciiProgramData
from app.core.errors import ErrorResponse
from app.schemas.luscii import LusciiProgramSummary
from app.services.auth.deps import CurrentUserDep
from app.services.luscii.deps import LusciiServiceDep

router = APIRouter(prefix="/luscii", tags=["luscii"])

_ERRORS_404: dict[int | str, dict[str, Any]] = {404: {"model": ErrorResponse}}


@router.get(
    "/programs",
    operation_id="list_luscii_programs",
    response_model=list[LusciiProgramSummary],
)
async def list_luscii_programs(
    _current_user: CurrentUserDep,
    service: LusciiServiceDep,
) -> list[LusciiProgramSummary]:
    return service.list_programs()


@router.get(
    "/programs/{program_id}",
    operation_id="get_luscii_program",
    response_model=LusciiProgramData,
    responses=_ERRORS_404,
)
async def get_luscii_program(
    program_id: str,
    _current_user: CurrentUserDep,
    service: LusciiServiceDep,
) -> LusciiProgramData:
    return service.get_program(program_id)
