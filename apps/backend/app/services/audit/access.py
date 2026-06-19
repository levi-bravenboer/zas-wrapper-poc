"""Read-access capture for patient data (fhir-aligned-audit-trail §5).

The `before_flush` diff hook captures writes only, so patient-data *reads* are
recorded explicitly here. Both helpers write via `emit_committed` in an
independent session: a successful read should persist even if the request's
own (read-only) transaction never commits, and a denied read is on a 4xx whose
request session rolls back.

These are the reusable mechanism; wiring them onto concrete GET routes / the
patient-access guard is the emit-site coverage phase (§5.2, §7).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.enums.audit import AuditAction, AuditResult, PurposeOfUse
from app.schemas.auth.auth import SessionUser
from app.services.audit.context import AuditContext
from app.services.audit.emit import emit_committed


async def record_patient_read(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    actor: SessionUser,
    patient_id: UUID,
    event_code: str,
    purpose_of_use: PurposeOfUse = PurposeOfUse.TREATMENT,
    request_id: UUID | None = None,
    context: AuditContext | None = None,
) -> None:
    """Record one successful patient-data read (one row per logical dossier
    view). `purpose_of_use` defaults to `treatment` (role-derived); callers
    pass an override for emergency / break-the-glass access.
    """

    await emit_committed(
        session_factory,
        action=AuditAction.READ,
        result=AuditResult.SUCCESS,
        event_code=event_code,
        patient_id=patient_id,
        purpose_of_use=purpose_of_use,
        request_id=request_id,
        context=context,
        actor=actor,
    )


async def record_denied_access(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    actor: SessionUser | None,
    patient_id: UUID,
    event_code: str,
    purpose_of_use: PurposeOfUse = PurposeOfUse.TREATMENT,
    request_id: UUID | None = None,
    context: AuditContext | None = None,
) -> None:
    """Record a denied patient-data access (403) as `read` + `failure`. This is
    the event NEN 7513 and break-the-glass detection most need; the success-only
    read path would otherwise leave unauthorized attempts invisible.
    """

    await emit_committed(
        session_factory,
        action=AuditAction.READ,
        result=AuditResult.FAILURE,
        event_code=event_code,
        patient_id=patient_id,
        purpose_of_use=purpose_of_use,
        request_id=request_id,
        context=context,
        actor=actor,
    )
