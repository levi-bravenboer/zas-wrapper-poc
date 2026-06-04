"""Canonical derivation: Postgres domain rows → expected Keto tuples.

This module is the single source of the tuple vocabulary. The relay
(`relay.py`) and the reconciler (`reconciler.py`) both converge Keto
toward what these functions return — never write tuples any other way
(demo seeds go through the reconciler).

Mapping (see `infra/ory/keto/namespaces.keto.ts` — keep both in sync):
- `organisations.parent_organisation_id`            → Organisation#parent
- open `practitioner_roles` (via `practitioners`)   → Organisation#member
- open `care_team_participants`                     → CareTeam#member
- active `care_teams`                               → Patient#care_team
- `patients.primary_organisation_id`                → Patient#treating_org
- open roles × `practitioner_role_specialisms`      → Specialism#practitioner
- `pathway_practitioners` / `pathway_specialisms`   → Carepath#assigned XOR
                                                      Carepath#specialism
- open unexpired `access_grants` (break-glass)      → Patient#break_glass
- open `external_grants` ∩ active consent ∩ profile → Patient#external_<verb>

Conditional rules live HERE, not in OPL permits (pure set algebra):
- assigned-XOR-specialism (REQ-NON-12): when a carepath has explicit
  practitioner assignments, ONLY `assigned` tuples are emitted; otherwise
  ONLY `specialism` edges. Never both.
- time bounds (grant expiry, lapsed periods) are predicates in the queries;
  the sweep (`sweep.py`) merely re-enqueues affected objects so the relay
  re-derives.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.access import ConsentStatus
from app.core.enums.care_team import CareTeamStatus
from app.db.models.access.access_grant import AccessGrant
from app.db.models.access.consent import Consent
from app.db.models.access.external_access import ExternalAccessProfile, ExternalGrant
from app.db.models.care_team.care_team import CareTeam
from app.db.models.care_team.care_team_participant import CareTeamParticipant
from app.db.models.organisation.organisation import Organisation
from app.db.models.pathway.pathway import Pathway
from app.db.models.pathway.pathway_access import PathwayPractitioner, PathwaySpecialism
from app.db.models.patient.patient import Patient
from app.db.models.practitioner.practitioner import Practitioner
from app.db.models.practitioner.practitioner_role import PractitionerRole
from app.db.models.practitioner.specialism import PractitionerRoleSpecialism
from app.services.access.permissions.keto_client import (
    RelationTuple,
    SubjectSet,
    user_subject,
)

# Relations whose tuples are NOT derived from Postgres. Empty since
# `access-entitlements`: `Patient#external_carer` gained a domain source
# (external_grants + consents — converted by scripts/backfill_external_grants)
# and was replaced by the verb relations below. The mechanism stays for the
# next relation without a domain table.
EXTERNAL_RELATIONS: frozenset[tuple[str, str]] = frozenset()

_VERB_RELATIONS: tuple[tuple[str, str], ...] = (
    ("allow_read", "external_reader"),
    ("allow_write", "external_writer"),
    ("allow_record", "external_recorder"),
    ("allow_message", "external_messager"),
)


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


async def derive_specialism_tuples(
    session: AsyncSession, *, specialism_id: UUID | None = None
) -> set[RelationTuple]:
    """`Specialism#practitioner` from open roles joined through the link table."""

    tuples: set[RelationTuple] = set()
    query = (
        select(PractitionerRoleSpecialism.specialism_id, Practitioner.user_id)
        .join(
            PractitionerRole,
            PractitionerRole.id == PractitionerRoleSpecialism.practitioner_role_id,
        )
        .join(Practitioner, Practitioner.id == PractitionerRole.practitioner_id)
        .where(
            PractitionerRoleSpecialism.deleted_at.is_(None),
            PractitionerRole.period_end.is_(None),
            PractitionerRole.deleted_at.is_(None),
            Practitioner.deleted_at.is_(None),
        )
    )
    if specialism_id is not None:
        query = query.where(PractitionerRoleSpecialism.specialism_id == specialism_id)
    for sid, member_user_id in (await session.execute(query)).all():
        tuples.add(
            RelationTuple(
                namespace="Specialism",
                object_id=str(sid),
                relation="practitioner",
                subject_id=user_subject(member_user_id),
            )
        )
    return tuples


async def derive_carepath_tuples(
    session: AsyncSession, *, pathway_id: UUID | None = None
) -> set[RelationTuple]:
    """Carepath access tuples — assigned-XOR-specialism per REQ-NON-12.

    A carepath with explicit `pathway_practitioners` rows emits ONLY
    `assigned` tuples (the assignment narrows the specialism set); a
    carepath without emits ONLY `specialism` subject-set edges. The OPL
    permit is the plain union of both relations — this function is what
    makes the conditional hold.
    """

    tuples: set[RelationTuple] = set()

    pathway_query = select(Pathway.id).where(Pathway.deleted_at.is_(None))
    if pathway_id is not None:
        pathway_query = pathway_query.where(Pathway.id == pathway_id)
    pathway_ids = [row[0] for row in (await session.execute(pathway_query)).all()]
    if not pathway_ids:
        return tuples

    assigned_query = select(PathwayPractitioner.pathway_id, PathwayPractitioner.user_id).where(
        PathwayPractitioner.deleted_at.is_(None),
        PathwayPractitioner.pathway_id.in_(pathway_ids),
    )
    assigned_by_pathway: dict[UUID, list[UUID]] = {}
    for pw_id, assignee_user_id in (await session.execute(assigned_query)).all():
        assigned_by_pathway.setdefault(pw_id, []).append(assignee_user_id)

    specialism_query = select(PathwaySpecialism.pathway_id, PathwaySpecialism.specialism_id).where(
        PathwaySpecialism.deleted_at.is_(None),
        PathwaySpecialism.pathway_id.in_(pathway_ids),
    )
    for pw_id, sid in (await session.execute(specialism_query)).all():
        if pw_id in assigned_by_pathway:
            continue  # explicit assignment wins — no specialism edge
        tuples.add(
            RelationTuple(
                namespace="Carepath",
                object_id=str(pw_id),
                relation="specialism",
                subject_set=SubjectSet(namespace="Specialism", object_id=str(sid)),
            )
        )
    for pw_id, assignee_user_ids in assigned_by_pathway.items():
        for assignee_user_id in assignee_user_ids:
            tuples.add(
                RelationTuple(
                    namespace="Carepath",
                    object_id=str(pw_id),
                    relation="assigned",
                    subject_id=user_subject(assignee_user_id),
                )
            )
    return tuples


async def derive_patient_tuples(
    session: AsyncSession, *, patient_id: UUID | None = None
) -> set[RelationTuple]:
    tuples: set[RelationTuple] = set()
    now = datetime.now(UTC)

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

    # break-glass: open, unexpired, unrevoked grants (REQ-NON-8). Expiry is
    # a time predicate here; the sweep re-enqueues lapsed grants' patients.
    grant_query = select(AccessGrant.patient_id, AccessGrant.user_id).where(
        AccessGrant.deleted_at.is_(None),
        AccessGrant.revoked_at.is_(None),
        AccessGrant.expires_at > now,
    )
    if patient_id is not None:
        grant_query = grant_query.where(AccessGrant.patient_id == patient_id)
    for pid, grantee_user_id in (await session.execute(grant_query)).all():
        tuples.add(
            RelationTuple(
                namespace="Patient",
                object_id=str(pid),
                relation="break_glass",
                subject_id=user_subject(grantee_user_id),
            )
        )

    # external verbs: grant open ∩ consent active ∩ type profile (REQ-FUN-1/42)
    external_query = (
        select(
            ExternalGrant.patient_id,
            ExternalGrant.user_id,
            ExternalAccessProfile.allow_read,
            ExternalAccessProfile.allow_write,
            ExternalAccessProfile.allow_record,
            ExternalAccessProfile.allow_message,
        )
        .join(Consent, Consent.id == ExternalGrant.consent_id)
        .join(
            ExternalAccessProfile,
            (ExternalAccessProfile.tenant_id == ExternalGrant.tenant_id)
            & (ExternalAccessProfile.professional_type == ExternalGrant.professional_type),
        )
        .where(
            ExternalGrant.deleted_at.is_(None),
            (ExternalGrant.period_end.is_(None)) | (ExternalGrant.period_end > now),
            Consent.deleted_at.is_(None),
            Consent.status == ConsentStatus.ACTIVE,
            ExternalAccessProfile.deleted_at.is_(None),
        )
    )
    if patient_id is not None:
        external_query = external_query.where(ExternalGrant.patient_id == patient_id)
    for pid, ext_user_id, *flags in (await session.execute(external_query)).all():
        for (_, relation), allowed in zip(_VERB_RELATIONS, flags, strict=True):
            if allowed:
                tuples.add(
                    RelationTuple(
                        namespace="Patient",
                        object_id=str(pid),
                        relation=relation,
                        subject_id=user_subject(ext_user_id),
                    )
                )
    return tuples


async def derive_all_tuples(session: AsyncSession) -> set[RelationTuple]:
    return (
        await derive_organisation_tuples(session)
        | await derive_care_team_tuples(session)
        | await derive_specialism_tuples(session)
        | await derive_carepath_tuples(session)
        | await derive_patient_tuples(session)
    )
