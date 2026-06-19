"""Role management (`dynamic-rbac-roles-permissions`).

Admins define tenant roles and assign catalog permissions. Guarded by the
`role.*` permissions; the service enforces the privilege-escalation rules
(no amplification; crown permissions admin-only). Assigning a user TO a role
lives on the user surface (`PATCH /users/{id}/role`).
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.enums import Permission
from app.db.engine import SessionDep
from app.db.models.access.role import Role
from app.schemas.access.role import RoleCreate, RoleRead, RoleUpdate
from app.schemas.auth.auth import SessionUser
from app.services.access.rbac.deps import require_permission
from app.services.access.rbac.role_service import RoleService, permission_catalog

router = APIRouter(tags=["roles"])

_READ_GUARD = Depends(require_permission(Permission.ROLE_READ))
_CREATE_GUARD = Depends(require_permission(Permission.ROLE_CREATE))
_UPDATE_GUARD = Depends(require_permission(Permission.ROLE_UPDATE))
_DELETE_GUARD = Depends(require_permission(Permission.ROLE_DELETE))


def get_role_service(session: SessionDep) -> RoleService:
    return RoleService(session)


RoleServiceDep = Annotated[RoleService, Depends(get_role_service)]


def _to_read(role: Role, permissions: list[str]) -> RoleRead:
    return RoleRead(
        id=role.id,
        slug=role.slug,
        name=role.name,
        is_system=role.is_system,
        permissions=permissions,
        created_at=role.created_at,
    )


@router.get("/permissions", operation_id="list_permissions", response_model=list[str])
async def list_permissions(
    current_user: Annotated[SessionUser, _READ_GUARD],  # AUTH-HARDEN: role.read
) -> list[str]:
    return permission_catalog()


@router.get("/roles", operation_id="list_roles", response_model=list[RoleRead])
async def list_roles(
    service: RoleServiceDep,
    current_user: Annotated[SessionUser, _READ_GUARD],  # AUTH-HARDEN: role.read
) -> list[RoleRead]:
    return [
        _to_read(role, perms) for role, perms in await service.list_roles(current_user.tenant_id)
    ]


@router.get("/roles/{role_id}", operation_id="get_role", response_model=RoleRead)
async def get_role(
    role_id: UUID,
    service: RoleServiceDep,
    current_user: Annotated[SessionUser, _READ_GUARD],  # AUTH-HARDEN: role.read
) -> RoleRead:
    role, perms = await service.get_role(current_user.tenant_id, role_id)
    return _to_read(role, perms)


@router.post(
    "/roles",
    operation_id="create_role",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_role(
    payload: RoleCreate,
    service: RoleServiceDep,
    current_user: Annotated[SessionUser, _CREATE_GUARD],  # AUTH-HARDEN: role.create
) -> RoleRead:
    role, perms = await service.create_role(
        current_user, slug=payload.slug, name=payload.name, permissions=payload.permissions
    )
    return _to_read(role, perms)


@router.patch("/roles/{role_id}", operation_id="update_role", response_model=RoleRead)
async def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    service: RoleServiceDep,
    current_user: Annotated[SessionUser, _UPDATE_GUARD],  # AUTH-HARDEN: role.update
) -> RoleRead:
    role, perms = await service.update_role(
        current_user, role_id, name=payload.name, permissions=payload.permissions
    )
    return _to_read(role, perms)


@router.delete(
    "/roles/{role_id}", operation_id="delete_role", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_role(
    role_id: UUID,
    service: RoleServiceDep,
    current_user: Annotated[SessionUser, _DELETE_GUARD],  # AUTH-HARDEN: role.delete
) -> None:
    await service.delete_role(current_user, role_id)
