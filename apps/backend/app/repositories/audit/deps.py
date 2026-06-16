from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.db.engine import SessionDep
from app.repositories.audit.audit_event_repository import AuditEventRepository


def get_audit_event_repository(session: SessionDep) -> AuditEventRepository:
    return AuditEventRepository(session)


AuditEventRepoDep = Annotated[AuditEventRepository, Depends(get_audit_event_repository)]
