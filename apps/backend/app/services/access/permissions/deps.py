"""Permission dependencies — the request-path face of the AME.

`check_patient_permission` is consumed by `require_patient_access`
(`app/services/patient/deps.py`), the single wiring point for all
patient-scoped routes (BL-053); `require_carepath_access` plays the same
role for carepath routes (REQ-NON-10/12). Behind `AUTHZ_KETO_ENABLED`:

- flag off → callers fall back to the pre-Ory SQL predicates, byte-for-byte
  the previous behaviour;
- flag on  → one Keto `check` answers care-team membership, org-tree
  reachability, and external-episode access in a single relation walk.

Admins short-circuit to allow (tenant-wide read is a role decision, not a
relation). Denials surface as `None`/`False` so callers keep the existing
404-not-403 existence-hiding contract.
"""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.core.settings import SettingsDep
from app.db.engine import SessionDep
from app.db.models.pathway.pathway_access import PathwayPractitioner, PathwaySpecialism
from app.db.models.practitioner.practitioner import Practitioner
from app.db.models.practitioner.practitioner_role import PractitionerRole
from app.db.models.practitioner.specialism import PractitionerRoleSpecialism
from app.schemas.auth.auth import SessionUser
from app.services.access.identity.deps import require_role
from app.services.access.permissions.keto_client import KetoClient, user_subject

PatientRelation = Literal["view", "view_shielded", "edit", "record", "message"]


def get_keto_client(request: Request) -> KetoClient:
    return request.app.state.keto_client


KetoClientDep = Annotated[KetoClient, Depends(get_keto_client)]


async def check_patient_permission(
    keto: KetoClient,
    *,
    patient_id: UUID,
    user_id: UUID,
    relation: PatientRelation = "view",
) -> bool:
    return await keto.check(
        namespace="Patient",
        object_id=str(patient_id),
        relation=relation,
        subject_id=user_subject(user_id),
    )


async def check_carepath_permission(
    keto: KetoClient,
    *,
    pathway_id: UUID,
    user_id: UUID,
) -> bool:
    return await keto.check(
        namespace="Carepath",
        object_id=str(pathway_id),
        relation="view",
        subject_id=user_subject(user_id),
    )


async def require_carepath_access(
    pathway_id: UUID,
    session: SessionDep,
    settings: SettingsDep,
    keto: KetoClientDep,
    current_user: SessionUser = Depends(require_role(Role.ADMIN, Role.CAREGIVER)),
) -> None:
    """Enforce specialism/assignment scoping on a carepath route (REQ-NON-10/12).

    Rollout rule: a carepath with NO specialism links and NO explicit
    assignments is unscoped — open to every caregiver, exactly the pre-change
    behaviour (and what flag-off reproduces). Scoping bites once links are
    configured. Admins short-circuit; denial surfaces as 404 downstream
    (the route's own not-found error) by raising here.
    """

    if not settings.authz_keto_enabled or current_user.role == Role.ADMIN:
        return

    scoped = await session.scalar(
        select(PathwaySpecialism.id)
        .where(PathwaySpecialism.pathway_id == pathway_id, PathwaySpecialism.deleted_at.is_(None))
        .limit(1)
    ) or await session.scalar(
        select(PathwayPractitioner.id)
        .where(
            PathwayPractitioner.pathway_id == pathway_id,
            PathwayPractitioner.deleted_at.is_(None),
        )
        .limit(1)
    )
    if scoped is None:
        return

    allowed = await check_carepath_permission(
        keto, pathway_id=pathway_id, user_id=current_user.id
    )
    if not allowed:
        # import here: access → pathway would otherwise be a static cycle risk
        from app.services.pathway.errors import PathwayNotFoundError

        raise PathwayNotFoundError()


CarepathAccessDep = Depends(require_carepath_access)


async def hidden_carepath_ids(session: AsyncSession, user_id: UUID) -> set[UUID]:
    """Scoped carepaths the user cannot see — the SQL mirror of
    `Carepath.view` for LIST endpoints (set-derivation stays in Postgres,
    same division as the patient list — design D2/D5 lineage).

    A carepath is hidden iff it is scoped (has links or assignments) AND
    the user is neither explicitly assigned nor, absent assignments, a
    holder of an open role linked to one of its specialisms.
    """

    my_specialisms = {
        row[0]
        for row in (
            await session.execute(
                select(PractitionerRoleSpecialism.specialism_id)
                .join(
                    PractitionerRole,
                    PractitionerRole.id == PractitionerRoleSpecialism.practitioner_role_id,
                )
                .join(Practitioner, Practitioner.id == PractitionerRole.practitioner_id)
                .where(
                    Practitioner.user_id == user_id,
                    PractitionerRole.period_end.is_(None),
                    PractitionerRole.deleted_at.is_(None),
                    PractitionerRoleSpecialism.deleted_at.is_(None),
                )
            )
        ).all()
    }
    pathway_specialisms: dict[UUID, set[UUID]] = {}
    for pw_id, spec_id in (
        await session.execute(
            select(PathwaySpecialism.pathway_id, PathwaySpecialism.specialism_id).where(
                PathwaySpecialism.deleted_at.is_(None)
            )
        )
    ).all():
        pathway_specialisms.setdefault(pw_id, set()).add(spec_id)
    assignments: dict[UUID, set[UUID]] = {}
    for pw_id, assignee in (
        await session.execute(
            select(PathwayPractitioner.pathway_id, PathwayPractitioner.user_id).where(
                PathwayPractitioner.deleted_at.is_(None)
            )
        )
    ).all():
        assignments.setdefault(pw_id, set()).add(assignee)

    hidden: set[UUID] = set()
    for pw_id in set(pathway_specialisms) | set(assignments):
        if pw_id in assignments:
            if user_id not in assignments[pw_id]:
                hidden.add(pw_id)
        elif not (pathway_specialisms.get(pw_id, set()) & my_specialisms):
            hidden.add(pw_id)
    return hidden
