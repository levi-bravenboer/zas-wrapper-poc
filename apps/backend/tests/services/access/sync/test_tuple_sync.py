from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.db.models.authz import AuthzOutbox
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.patient import Patient
from app.services.access.permissions.keto_client import RelationTuple, user_subject
from app.services.access.sync.relay import process_pending
from app.services.access.sync.reconciler import reconcile_all
from scripts.seed_users import ADMIN_USER_ID, CAREGIVER_EMAIL
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


async def test_reconcile_removes_orphans_and_preserves_external(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    patients, _ = seeded_domain
    keto = FakeKetoClient()
    await reconcile_all(db_session, keto)

    orphan = RelationTuple(
        namespace="CareTeam",
        object_id="00000000-0000-4000-8000-00000000dead",
        relation="member",
        subject_id="User:nobody",
    )
    external = RelationTuple(
        namespace="Patient",
        object_id=str(patients[0].id),
        relation="external_carer",
        subject_id="User:external-gp",
    )
    await keto.insert_tuple(orphan)
    await keto.insert_tuple(external)

    stats = await reconcile_all(db_session, keto)

    assert orphan not in keto.tuples, "orphaned derived tuple must be removed"
    assert external in keto.tuples, "external_carer has no domain source and must survive"
    assert stats.deleted == 1


async def test_external_carer_views_but_not_shielded(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    patients, _ = seeded_domain
    keto = FakeKetoClient()
    await reconcile_all(db_session, keto)
    pid = str(patients[0].id)

    await keto.insert_tuple(
        RelationTuple(
            namespace="Patient",
            object_id=pid,
            relation="external_carer",
            subject_id="User:external-gp",
        )
    )

    assert await keto.check(
        namespace="Patient", object_id=pid, relation="view", subject_id="User:external-gp"
    )
    assert not await keto.check(
        namespace="Patient",
        object_id=pid,
        relation="view_shielded",
        subject_id="User:external-gp",
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
