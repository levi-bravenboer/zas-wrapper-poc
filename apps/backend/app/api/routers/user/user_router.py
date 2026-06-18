from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api._list.deps import ListQueryParamsDep
from app.core.enums import Permission
from app.repositories.user.deps import UserRepoDep
from app.schemas._list.page import Page
from app.schemas.auth.auth import SessionUser
from app.schemas.user.user import (
    AssignRoleRequest,
    SetActiveRequest,
    UserCreate,
    UserDetail,
    UserRow,
    UserUpdate,
)
from app.services.access.rbac.deps import require_permission
from app.services.user.deps import UserServiceDep

router = APIRouter(tags=["users"])

_READ_GUARD = Depends(require_permission(Permission.USER_READ))
_CREATE_GUARD = Depends(require_permission(Permission.USER_CREATE))
_UPDATE_GUARD = Depends(require_permission(Permission.USER_UPDATE))


@router.get(
    "/users",
    operation_id="list_users",
    response_model=Page[UserRow],
)
async def list_users(
    query: ListQueryParamsDep,
    repo: UserRepoDep,
    _user: SessionUser = _READ_GUARD,
) -> Page[UserRow]:
    # Repository yields Page[User] (ORM rows); FastAPI's response_model converts to
    # Page[UserRow] via Pydantic's `from_attributes`. Type checker can't see that.
    return await repo.list_page(query)  # type: ignore[return-value]


@router.get(
    "/users/{user_id}",
    operation_id="get_user",
    response_model=UserDetail,
)
async def get_user(
    user_id: UUID,
    service: UserServiceDep,
    admin: SessionUser = _READ_GUARD,
) -> UserDetail:
    user = await service.get(admin, user_id)
    return UserDetail.model_validate(user)


# AUTH-HARDEN: write gated on `user.create` via require_permission.
@router.post(
    "/users",
    operation_id="create_user",
    status_code=status.HTTP_201_CREATED,
    response_model=UserRow,
)
async def create_user(
    payload: UserCreate,
    service: UserServiceDep,
    admin: SessionUser = _CREATE_GUARD,
) -> UserRow:
    user = await service.create(admin, payload)
    return UserRow.model_validate(user)


# AUTH-HARDEN: write gated on `user.update` via require_permission.
@router.patch(
    "/users/{user_id}",
    operation_id="update_user",
    response_model=UserRow,
)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    service: UserServiceDep,
    admin: SessionUser = _UPDATE_GUARD,
) -> UserRow:
    user = await service.update_demographics(admin, user_id, payload)
    return UserRow.model_validate(user)


@router.patch(
    "/users/{user_id}/role",
    operation_id="update_user_role",
    response_model=UserRow,
)
async def update_user_role(
    user_id: UUID,
    payload: AssignRoleRequest,
    service: UserServiceDep,
    admin: SessionUser = _UPDATE_GUARD,
) -> UserRow:
    user = await service.assign_role(admin, user_id, payload.role_id)
    return UserRow.model_validate(user)


@router.patch(
    "/users/{user_id}/active",
    operation_id="set_user_active",
    response_model=UserRow,
)
async def set_user_active(
    user_id: UUID,
    payload: SetActiveRequest,
    service: UserServiceDep,
    admin: SessionUser = _UPDATE_GUARD,
) -> UserRow:
    user = await service.set_active(admin, user_id, is_active=payload.is_active)
    return UserRow.model_validate(user)


__all__ = ["router"]
