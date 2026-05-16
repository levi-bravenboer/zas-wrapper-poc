"""Visibility predicates derived from `PractitionerRole` rows.

`practitioner_root_orgs_for(session, user)` returns the set of org-tree
root ids the user can act under via at least one open
`PractitionerRole`. A caregiver sees a patient when one of:

- they have an open `CareTeamParticipant` row on a care team for that
  patient (the legacy predicate, kept verbatim), OR
- the root of `patient.primary_organisation_id` is in their
  `practitioner_root_orgs_for` set.

Admins bypass both checks.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.organisation import Organisation
from app.db.models.patient import Patient
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.schemas.auth.auth import SessionUser


async def practitioner_root_orgs_for(
    session: AsyncSession, user: SessionUser
) -> set[UUID]:
    result = await session.execute(
        select(PractitionerRole.organisation_id)
        .join(Practitioner, Practitioner.id == PractitionerRole.practitioner_id)
        .where(
            Practitioner.user_id == user.id,
            PractitionerRole.tenant_id == user.tenant_id,
            PractitionerRole.period_end.is_(None),
            PractitionerRole.deleted_at.is_(None),
        )
        .distinct()
    )
    org_ids = list(result.scalars().all())
    if not org_ids:
        return set()
    return await _root_ids_for(session, user.tenant_id, org_ids)


async def _root_ids_for(
    session: AsyncSession, tenant_id: UUID, organisation_ids: list[UUID]
) -> set[UUID]:
    anchor = (
        select(
            Organisation.id.label("seed_id"),
            Organisation.id,
            Organisation.parent_organisation_id,
            Organisation.tenant_id,
        )
        .where(
            Organisation.id.in_(organisation_ids),
            Organisation.tenant_id == tenant_id,
            Organisation.deleted_at.is_(None),
        )
        .cte("anc_anchor", recursive=True)
    )
    parent = Organisation.__table__.alias("anc_parent")
    ancestors = anchor.union_all(
        select(
            anchor.c.seed_id,
            parent.c.id,
            parent.c.parent_organisation_id,
            parent.c.tenant_id,
        ).select_from(
            anchor.join(
                parent,
                (parent.c.id == anchor.c.parent_organisation_id)
                & (parent.c.tenant_id == anchor.c.tenant_id)
                & (parent.c.deleted_at.is_(None)),
            )
        )
    )
    result = await session.execute(
        select(ancestors.c.id).where(ancestors.c.parent_organisation_id.is_(None))
    )
    return set(result.scalars().all())


async def patient_ids_under_roots(
    session: AsyncSession, tenant_id: UUID, root_org_ids: set[UUID]
) -> set[UUID]:
    """Return patient ids whose `primary_organisation_id` descends from
    any org in `root_org_ids` (inclusive of the root itself)."""

    if not root_org_ids:
        return set()
    anchor = (
        select(Organisation.id, Organisation.tenant_id)
        .where(
            Organisation.id.in_(root_org_ids),
            Organisation.tenant_id == tenant_id,
            Organisation.deleted_at.is_(None),
        )
        .cte("desc_anchor", recursive=True)
    )
    child = Organisation.__table__.alias("desc_child")
    descendants = anchor.union_all(
        select(child.c.id, child.c.tenant_id).select_from(
            anchor.join(
                child,
                (child.c.parent_organisation_id == anchor.c.id)
                & (child.c.tenant_id == anchor.c.tenant_id)
                & (child.c.deleted_at.is_(None)),
            )
        )
    )
    result = await session.execute(
        select(Patient.id).where(
            Patient.primary_organisation_id.in_(select(descendants.c.id)),
            Patient.tenant_id == tenant_id,
            Patient.deleted_at.is_(None),
        )
    )
    return set(result.scalars().all())


async def patient_root_org(
    session: AsyncSession, tenant_id: UUID, organisation_id: UUID
) -> UUID | None:
    """Return the org-tree root id for `organisation_id` within `tenant_id`."""

    roots = await _root_ids_for(session, tenant_id, [organisation_id])
    if len(roots) != 1:
        return None
    return next(iter(roots))
