from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.access import ConsentStatus
from app.core.enums.practitioner_role import PractitionerRoleCode
from app.core.settings import get_settings
from app.db.models.access.consent import Consent
from app.db.models.access.external_access import ExternalAccessProfile, ExternalGrant
from app.db.models.user import User
from app.db.models.authz import AuthzOutbox
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.patient import Patient
from app.services.access.permissions.keto_client import RelationTuple, user_subject
from app.services.access.sync.relay import process_pending
from app.services.access.sync.reconciler import reconcile_all
from scripts.seed_users import ADMIN_USER_ID, CAREGIVER_EMAIL
from tests._rbac import ensure_roles
from tests.fakes.keto import FakeKetoClient

SeededDomain = tuple[list[Patient], list[CareTeam]]


@pytest.fixture
def keto_enabled(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Flip the env-backed flag the outbox hook reads via `get_settings()`."""

    monkeypatch.setenv("BACKEND_AUTHZ_KETO_ENABLED", "true")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def _caregiver_subject(session: AsyncSession) -> str:
    from app.db.models.user import User

    result = await session.execute(select(User).where(User.email == CAREGIVER_EMAIL))
    return user_subject(result.scalar_one().id)


async def test_reconcile_all_populates_from_domain(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    patients, _ = seeded_domain
    keto = FakeKetoClient()

    stats = await reconcile_all(db_session, keto)

    assert stats.inserted > 0 and stats.deleted == 0
    subject = await _caregiver_subject(db_session)
    for patient in patients:
        assert await keto.check(
            namespace="Patient", object_id=str(patient.id), relation="view", subject_id=subject
        )

    # second run converges to a no-op — derived state is stable
    stats = await reconcile_all(db_session, keto)
    assert not stats.drifted


async def test_reconcile_removes_orphans_including_legacy_external(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    """`external_carer` lost its externally-managed status in
    `access-entitlements`: external access now derives from
    external_grants + consents (scripts/backfill_external_grants converts
    legacy tuples), so an unbackfilled tuple is an orphan like any other."""

    patients, _ = seeded_domain
    keto = FakeKetoClient()
    await reconcile_all(db_session, keto)

    orphan = RelationTuple(
        namespace="CareTeam",
        object_id="00000000-0000-4000-8000-00000000dead",
        relation="member",
        subject_id="User:nobody",
    )
    legacy_external = RelationTuple(
        namespace="Patient",
        object_id=str(patients[0].id),
        relation="external_carer",
        subject_id="User:external-gp",
    )
    await keto.insert_tuple(orphan)
    await keto.insert_tuple(legacy_external)

    stats = await reconcile_all(db_session, keto)

    assert orphan not in keto.tuples, "orphaned derived tuple must be removed"
    assert legacy_external not in keto.tuples, "unbackfilled legacy tuple is an orphan"
    assert stats.deleted == 2


async def test_external_grant_derives_verbs_not_shielded(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    """Consent-backed grant + read/record profile → reader+recorder tuples;
    never writer, never view_shielded (REQ-FUN-1/42)."""

    patients, _ = seeded_domain
    target = patients[0]
    roles = await ensure_roles(db_session, target.tenant_id)
    external_user = User(
        email="external.gp@example.org",
        display_name="External GP",
        role_id=roles["default"].id,
        password_hash="x",
        is_active=True,
        tenant_id=target.tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
    )
    db_session.add(external_user)
    await db_session.flush()
    db_session.add(
        ExternalAccessProfile(
            professional_type=PractitionerRoleCode.GP,
            allow_read=True,
            allow_record=True,
            tenant_id=target.tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
        )
    )
    consent = Consent(
        patient_id=target.id,
        scope="external_collaboration",
        tenant_id=target.tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
    )
    db_session.add(consent)
    await db_session.flush()
    db_session.add(
        ExternalGrant(
            patient_id=target.id,
            user_id=external_user.id,
            professional_type=PractitionerRoleCode.GP,
            consent_id=consent.id,
            tenant_id=target.tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
        )
    )
    await db_session.commit()

    keto = FakeKetoClient()
    await reconcile_all(db_session, keto)
    pid = str(target.id)
    subject = user_subject(external_user.id)

    assert await keto.check(namespace="Patient", object_id=pid, relation="view", subject_id=subject)
    assert await keto.check(
        namespace="Patient", object_id=pid, relation="record", subject_id=subject
    )
    assert not await keto.check(
        namespace="Patient", object_id=pid, relation="edit", subject_id=subject
    )
    assert not await keto.check(
        namespace="Patient", object_id=pid, relation="view_shielded", subject_id=subject
    )

    # consent revocation drops every dependent verb tuple (derive-level)
    consent.status = ConsentStatus.REVOKED
    await db_session.commit()
    await reconcile_all(db_session, keto)
    assert not await keto.check(
        namespace="Patient", object_id=pid, relation="view", subject_id=subject
    )


async def test_participant_close_enqueues_outbox_row(
    db_session: AsyncSession, seeded_domain: SeededDomain, keto_enabled: None
) -> None:
    patients, _ = seeded_domain
    target = patients[0]
    rows = (
        (
            await db_session.execute(
                select(CareTeamParticipant)
                .join(CareTeam, CareTeam.id == CareTeamParticipant.care_team_id)
                .where(CareTeam.patient_id == target.id)
            )
        )
        .scalars()
        .all()
    )
    assert rows
    for row in rows:
        row.period_end = row.period_start
        row.unassigned_by = ADMIN_USER_ID
    await db_session.commit()

    pending = (
        (await db_session.execute(select(AuthzOutbox).where(AuthzOutbox.processed_at.is_(None))))
        .scalars()
        .all()
    )
    assert {p.namespace for p in pending} >= {"CareTeam"}
    assert {p.object_id for p in pending} >= {rows[0].care_team_id}


async def test_relay_revocation_end_to_end(
    db_session: AsyncSession, seeded_domain: SeededDomain, keto_enabled: None
) -> None:
    patients, _ = seeded_domain
    target = patients[0]
    keto = FakeKetoClient()
    await reconcile_all(db_session, keto)
    subject = await _caregiver_subject(db_session)
    pid = str(target.id)
    assert await keto.check(namespace="Patient", object_id=pid, relation="view", subject_id=subject)

    rows = (
        (
            await db_session.execute(
                select(CareTeamParticipant)
                .join(CareTeam, CareTeam.id == CareTeamParticipant.care_team_id)
                .where(CareTeam.patient_id == target.id)
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        row.period_end = row.period_start
        row.unassigned_by = ADMIN_USER_ID
    await db_session.commit()

    # Crash-safety: the outbox row committed with the domain change and
    # survives until a relay run picks it up (possibly after a restart).
    processed = await process_pending(db_session, keto)
    assert processed > 0

    assert not await keto.check(
        namespace="Patient", object_id=pid, relation="view", subject_id=subject
    )
    remaining = (
        (await db_session.execute(select(AuthzOutbox).where(AuthzOutbox.processed_at.is_(None))))
        .scalars()
        .all()
    )
    assert remaining == []
