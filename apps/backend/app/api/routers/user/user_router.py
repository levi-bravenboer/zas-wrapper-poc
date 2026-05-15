from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.enums.user import Role
from app.schemas.auth.auth import SessionUser
from app.schemas.user.user import AssignRoleRequest, UserRow
from app.services.auth.deps import require_role
from app.services.user.deps import UserServiceDep

router = APIRouter(tags=["users"])

_ADMIN_GUARD = Depends(require_role(Role.ADMIN))


@router.get(
    "/users",
    operation_id="list_tenant_users",
    response_model=list[UserRow],
)
async def list_tenant_users(
    service: UserServiceDep,
    current_user: SessionUser = _ADMIN_GUARD,
    active: bool | None = None,
) -> list[UserRow]:
    users = await service.list_in_tenant(current_user.tenant_id, active=active)
    return [UserRow.model_validate(u) for u in users]


@router.patch(
    "/users/{user_id}/role",
    operation_id="update_user_role",
    response_model=UserRow,
)
async def update_user_role(
    user_id: UUID,
    payload: AssignRoleRequest,
    service: UserServiceDep,
    current_user: SessionUser = _ADMIN_GUARD,
) -> UserRow:
    user = await service.assign_role(current_user, user_id, payload.role)
    return UserRow.model_validate(user)


__all__ = ["router"]
