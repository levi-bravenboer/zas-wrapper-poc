from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.tenant.tenant_repository import TenantRepository


def get_tenant_repository(session: SessionDep) -> TenantRepository:
    return TenantRepository(session)


TenantRepoDep = Annotated[TenantRepository, Depends(get_tenant_repository)]
