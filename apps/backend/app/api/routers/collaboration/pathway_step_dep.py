"""Access dependency for `pathway_step`-owned collaboration items.

Resolves a `PathwayBlockExecution` id to its enrollment's patient, then
applies the same care-team `view` + carepath gate the enrollment routes use,
so notes/files on a pathway step are visible to exactly the patient's care
team. Denial surfaces as 404 (existence-hiding, mirrors the enrollment
routes).
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select

from app.db.engine import SessionDep
from app.db.models.pathway.version import PathwayVersion
from app.core.settings import SettingsDep
from app.repositories.pathway.deps import EnrollmentRepoDep
from app.services.access.identity.deps import CurrentUserDep
from app.services.access.permissions.deps import (
    KetoClientDep,
    require_carepath_access,
)
from app.services.care_team.deps import CareTeamServiceDep
from app.services.patient.deps import (
    PatientServiceDep,
    resolve_patient_with_relation,
)
from app.services.pathway.errors import (
    BlockExecutionNotFoundError,
    EnrollmentNotFoundError,
    PathwayNotFoundError,
)


@dataclass(frozen=True)
class PathwayStepOwner:
    id: UUID
    patient_id: UUID


async def require_pathway_step_access(
    execution_id: UUID,
    repo: EnrollmentRepoDep,
    patient_service: PatientServiceDep,
    care_team_service: CareTeamServiceDep,
    session: SessionDep,
    settings: SettingsDep,
    keto: KetoClientDep,
    current_user: CurrentUserDep,
) -> PathwayStepOwner:
    execution = await repo.get_execution_by_id(execution_id, tenant_id=current_user.tenant_id)
    if execution is None:
        raise BlockExecutionNotFoundError()
    enrollment = await repo.get(execution.enrollment_id, tenant_id=current_user.tenant_id)
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
        relation="view",
    )
    pathway_id = await session.scalar(
        select(PathwayVersion.pathway_id).where(
            PathwayVersion.id == enrollment.pathway_version_id,
        )
    )
    if pathway_id is None:
        raise PathwayNotFoundError()
    await require_carepath_access(pathway_id, session, settings, keto, current_user)
    return PathwayStepOwner(id=execution.id, patient_id=enrollment.patient_id)


__all__ = ["PathwayStepOwner", "require_pathway_step_access"]
