"""Derivation + sweep tests for the access-entitlements extensions:
assigned-XOR-specialism (REQ-NON-12), specialism membership, break-glass
expiry through the sweep → outbox → relay path (REQ-NON-8).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.user import Role
from app.db.models.access.access_grant import AccessGrant
from app.db.models.care_team import CareTeam
from app.db.models.pathway import Pathway
from app.db.models.pathway.pathway_access import PathwayPractitioner, PathwaySpecialism
from app.db.models.patient import Patient
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.practitioner.specialism import PractitionerRoleSpecialism, Specialism
from app.db.models.user import User
from app.services.access.permissions.keto_client import user_subject
from app.services.access.sync.derive import derive_carepath_tuples
from app.services.access.sync.reconciler import reconcile_all
from app.services.access.sync.relay import process_pending
from app.services.access.sync.sweep import sweep_expired_grants
from scripts.seed_practitioners import seed_practitioners
from scripts.seed_users import ADMIN_USER_ID, CAREGIVER_EMAIL
from tests.fakes.keto import FakeKetoClient

SeededDomain = tuple[list[Patient], list[CareTeam]]


async def _caregiver(session: AsyncSession) -> User:
    result = await session.execute(
        select(User).where(User.email == CAREGIVER_EMAIL, User.role == Role.CAREGIVER)
    )
    return result.scalar_one()


async def _seed_specialised_pathway(
    session: AsyncSession, *, tenant_id: object
) -> tuple[Pathway, Specialism, PractitionerRole]:
    """Pathway linked to a specialism held by the demo caregiver's open role."""

    await seed_practitioners(session)  # seeded_domain stops at care teams
    await session.commit()
    caregiver = await _caregiver(session)
    practitioner = (
        await session.execute(select(Practitioner).where(Practitioner.user_id == caregiver.id))
    ).scalar_one()
    role = (
        (
            await session.execute(
                select(PractitionerRole).where(
                    PractitionerRole.practitioner_id == practitioner.id,
                    PractitionerRole.period_end.is_(None),
                )
            )
        )
        .scalars()
        .first()
    )
    assert role is not None
    audit = {"tenant_id": tenant_id, "created_by": ADMIN_USER_ID, "updated_by": ADMIN_USER_ID}
    specialism = Specialism(code="orthopedics", display="Orthopedie", **audit)
    pathway = Pathway(name="Scoped pathway", **audit)
    session.add_all([specialism, pathway])
    await session.flush()
    session.add(
        PractitionerRoleSpecialism(
            practitioner_role_id=role.id, specialism_id=specialism.id, **audit
        )
    )
    session.add(PathwaySpecialism(pathway_id=pathway.id, specialism_id=specialism.id, **audit))
    await session.commit()
    return pathway, specialism, role


async def test_assigned_xor_specialism_invariant(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    patients, _ = seeded_domain
    pathway, _, _ = await _seed_specialised_pathway(db_session, tenant_id=patients[0].tenant_id)

    derived = await derive_carepath_tuples(db_session, pathway_id=pathway.id)
    relations = {t.relation for t in derived}
    assert relations == {"specialism"}, "no assignment → specialism edges only"

    caregiver = await _caregiver(db_session)
    db_session.add(
        PathwayPractitioner(
            pathway_id=pathway.id,
            user_id=caregiver.id,
            tenant_id=patients[0].tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
        )
    )
    await db_session.commit()

    derived = await derive_carepath_tuples(db_session, pathway_id=pathway.id)
    relations = {t.relation for t in derived}
    assert relations == {"assigned"}, "explicit assignment suppresses specialism edges"


async def test_specialism_membership_grants_carepath_view(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    patients, _ = seeded_domain
    pathway, _, role = await _seed_specialised_pathway(db_session, tenant_id=patients[0].tenant_id)
    keto = FakeKetoClient()
    await reconcile_all(db_session, keto)
    caregiver = await _caregiver(db_session)
    subject = user_subject(caregiver.id)

    assert await keto.check(
        namespace="Carepath", object_id=str(pathway.id), relation="view", subject_id=subject
    )

    # closing the role drops specialism membership → carepath denied
    role.period_end = role.period_start
    await db_session.commit()
    await reconcile_all(db_session, keto)
    assert not await keto.check(
        namespace="Carepath", object_id=str(pathway.id), relation="view", subject_id=subject
    )


async def test_break_glass_expiry_via_sweep(
    db_session: AsyncSession, seeded_domain: SeededDomain
) -> None:
    patients, _ = seeded_domain
    target = patients[0]
    # grantee deliberately has NO care-team/org relation to the patient —
    # break-glass must be the only thing granting (and losing) access
    substitute = User(
        email="substitute@zas.local",
        display_name="Substitute",
        role=Role.CAREGIVER,
        password_hash="x",
        is_active=True,
        tenant_id=target.tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
    )
    db_session.add(substitute)
    await db_session.flush()
    subject = user_subject(substitute.id)
    keto = FakeKetoClient()

    grant = AccessGrant(
        patient_id=target.id,
        user_id=substitute.id,
        reason="vervanging spoeddienst",
        expires_at=datetime.now(UTC) + timedelta(hours=1),
        tenant_id=target.tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
    )
    db_session.add(grant)
    await db_session.commit()
    await reconcile_all(db_session, keto)
    assert await keto.check(
        namespace="Patient",
        object_id=str(target.id),
        relation="view_shielded",
        subject_id=subject,
    )

    # deadline passes with no row mutation — only the sweep notices
    grant.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()
    swept = await sweep_expired_grants(db_session, since=None, now=datetime.now(UTC))
    assert swept == 1
    processed = await process_pending(db_session, keto)
    assert processed >= 1
    assert not await keto.check(
        namespace="Patient",
        object_id=str(target.id),
        relation="view_shielded",
        subject_id=subject,
    )
