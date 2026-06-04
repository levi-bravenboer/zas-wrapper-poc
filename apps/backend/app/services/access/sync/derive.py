"""Canonical derivation: Postgres domain rows → expected Keto tuples.

This module is the single source of the tuple vocabulary. The relay
(`relay.py`) and the reconciler (`reconciler.py`) both converge Keto
toward what these functions return — never write tuples any other way
(demo seeds go through the reconciler).

Mapping (see `infra/ory/keto/namespaces.keto.ts`):
- `organisations.parent_organisation_id`            → Organisation#parent
- open `practitioner_roles` (via `practitioners`)   → Organisation#member
- open `care_team_participants`                     → CareTeam#member
- active `care_teams`                               → Patient#care_team
- `patients.primary_organisation_id`                → Patient#treating_org
- external episodes: no domain table yet (lands with the transmural work);
  `Patient#external_carer` tuples are seeded directly for the demo and are
  deliberately NOT part of the derived set, so the reconciler must not
  delete them — see `EXTERNAL_RELATIONS`.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.care_team import CareTeamStatus
from app.db.models.care_team.care_team import CareTeam
from app.db.models.care_team.care_team_participant import CareTeamParticipant
from app.db.models.organisation.organisation import Organisation
from app.db.models.patient.patient import Patient
from app.db.models.practitioner.practitioner import Practitioner
from app.db.models.practitioner.practitioner_role import PractitionerRole
from app.services.access.permissions.keto_client import (
    RelationTuple,
    SubjectSet,
    user_subject,
)

# Relations whose tuples are NOT derived from Postgres (yet). The reconciler
# leaves these untouched instead of treating them as orphans.
EXTERNAL_RELATIONS: frozenset[tuple[str, str]] = frozenset({("Patient", "external_carer")})


async def derive_organisation_tuples(
    session: AsyncSession, *, organisation_id: UUID | None = None
) -> set[RelationTuple]:
    tuples: set[RelationTuple] = set()

    org_query = select(Organisation.id, Organisation.parent_organisation_id).where(
        Organisation.deleted_at.is_(None)
    )
    if organisation_id is not None:
        org_query = org_query.where(Organisation.id == organisation_id)
    for org_id, parent_id in (await session.execute(org_query)).all():
        if parent_id is not None:
            tuples.add(
                RelationTuple(
                    namespace="Organisation",
                    object_id=str(org_id),
                    relation="parent",
                    subject_set=SubjectSet(namespace="Organisation", object_id=str(parent_id)),
                )
            )

    member_query = (
        select(PractitionerRole.organisation_id, Practitioner.user_id)
        .join(Practitioner, Practitioner.id == PractitionerRole.practitioner_id)
        .where(
            PractitionerRole.period_end.is_(None),
            PractitionerRole.deleted_at.is_(None),
            Practitioner.deleted_at.is_(None),
        )
    )
    if organisation_id is not None:
        member_query = member_query.where(PractitionerRole.organisation_id == organisation_id)
    for org_id, member_user_id in (await session.execute(member_query)).all():
        tuples.add(
            RelationTuple(
                namespace="Organisation",
                object_id=str(org_id),
                relation="member",
                subject_id=user_subject(member_user_id),
            )
        )
    return tuples


async def derive_care_team_tuples(
    session: AsyncSession, *, care_team_id: UUID | None = None
) -> set[RelationTuple]:
    tuples: set[RelationTuple] = set()
    member_query = (
        select(CareTeamParticipant.care_team_id, CareTeamParticipant.user_id)
        .join(CareTeam, CareTeam.id == CareTeamParticipant.care_team_id)
        .where(
            CareTeamParticipant.period_end.is_(None),
            CareTeam.deleted_at.is_(None),
            CareTeam.status == CareTeamStatus.ACTIVE,
        )
    )
    if care_team_id is not None:
        member_query = member_query.where(CareTeamParticipant.care_team_id == care_team_id)
    for team_id, member_user_id in (await session.execute(member_query)).all():
        tuples.add(
            RelationTuple(
                namespace="CareTeam",
                object_id=str(team_id),
                relation="member",
                subject_id=user_subject(member_user_id),
            )
        )
    return tuples


async def derive_patient_tuples(
    session: AsyncSession, *, patient_id: UUID | None = None
) -> set[RelationTuple]:
    tuples: set[RelationTuple] = set()

    patient_query = select(Patient.id, Patient.primary_organisation_id).where(
        Patient.deleted_at.is_(None)
    )
    if patient_id is not None:
        patient_query = patient_query.where(Patient.id == patient_id)
    for pid, org_id in (await session.execute(patient_query)).all():
        if org_id is not None:
            tuples.add(
                RelationTuple(
                    namespace="Patient",
                    object_id=str(pid),
                    relation="treating_org",
                    subject_set=SubjectSet(namespace="Organisation", object_id=str(org_id)),
                )
            )

    team_query = select(CareTeam.patient_id, CareTeam.id).where(
        CareTeam.deleted_at.is_(None),
        CareTeam.status == CareTeamStatus.ACTIVE,
    )
    if patient_id is not None:
        team_query = team_query.where(CareTeam.patient_id == patient_id)
    for pid, team_id in (await session.execute(team_query)).all():
        tuples.add(
            RelationTuple(
                namespace="Patient",
                object_id=str(pid),
                relation="care_team",
                subject_set=SubjectSet(namespace="CareTeam", object_id=str(team_id)),
            )
        )
    return tuples


async def derive_all_tuples(session: AsyncSession) -> set[RelationTuple]:
    return (
        await derive_organisation_tuples(session)
        | await derive_care_team_tuples(session)
        | await derive_patient_tuples(session)
    )
