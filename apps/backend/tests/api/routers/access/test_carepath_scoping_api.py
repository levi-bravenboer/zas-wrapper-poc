"""Carepath scoping route tests (REQ-NON-10/12): wrong specialism → 404,
unscoped carepaths stay open, list agrees with detail, admin bypass."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.care_team import CareTeam
from app.db.models.pathway import Pathway, PathwayVersion
from app.db.models.pathway.pathway_access import PathwaySpecialism
from app.db.models.patient import Patient
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.practitioner.specialism import PractitionerRoleSpecialism, Specialism
from app.db.models.user import User
from app.services.access.sync.reconciler import reconcile_all
from scripts.seed_users import ADMIN_EMAIL, ADMIN_USER_ID, CAREGIVER_EMAIL
from tests.fakes.keto import FakeKetoClient

_PASSWORD = "changeme"
SeededDomain = tuple[list[Patient], list[CareTeam]]


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _PASSWORD}
    )
    assert response.status_code == 200, response.text


async def _seed_pathways(
    db_session: AsyncSession, tenant_id: object, *, caregiver_email: str
) -> tuple[Pathway, Pathway]:
    """One cardiology-scoped pathway (caregiver NOT linked) + one unscoped."""

    audit = {"tenant_id": tenant_id, "created_by": ADMIN_USER_ID, "updated_by": ADMIN_USER_ID}
    cardio = Specialism(code="cardiology", display="Cardiologie", **audit)
    scoped = Pathway(name="Hartrevalidatie (scoped)", **audit)
    unscoped = Pathway(name="Open pathway", **audit)
    db_session.add_all([cardio, scoped, unscoped])
    await db_session.flush()
    db_session.add_all(
        [
            PathwaySpecialism(pathway_id=scoped.id, specialism_id=cardio.id, **audit),
            PathwayVersion(
                pathway_id=scoped.id, version_no=1, status="concept", kind="initial", **audit
            ),
            PathwayVersion(
                pathway_id=unscoped.id, version_no=1, status="concept", kind="initial", **audit
            ),
        ]
    )
    await db_session.commit()
    return scoped, unscoped


async def test_wrong_specialism_hides_carepath(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_access_domain
    scoped, unscoped = await _seed_pathways(
        db_session, patients[0].tenant_id, caregiver_email=CAREGIVER_EMAIL
    )
    await reconcile_all(db_session, fake_keto)

    await _login(async_client, CAREGIVER_EMAIL)
    # caregiver holds no cardiology specialism → scoped carepath hidden
    assert (await async_client.get(f"/pathways/{scoped.id}")).status_code == 404
    # unscoped carepath stays open (rollout rule)
    assert (await async_client.get(f"/pathways/{unscoped.id}")).status_code == 200

    listed = await async_client.get("/pathways")
    names = {p["name"] for p in listed.json()}
    assert "Open pathway" in names
    assert "Hartrevalidatie (scoped)" not in names, "list must agree with detail"


async def test_matching_specialism_grants_carepath(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_access_domain
    scoped, _ = await _seed_pathways(
        db_session, patients[0].tenant_id, caregiver_email=CAREGIVER_EMAIL
    )
    # link the caregiver's open role to cardiology
    caregiver = (
        await db_session.execute(select(User).where(User.email == CAREGIVER_EMAIL))
    ).scalar_one()
    role = (
        (
            await db_session.execute(
                select(PractitionerRole)
                .join(Practitioner, Practitioner.id == PractitionerRole.practitioner_id)
                .where(Practitioner.user_id == caregiver.id, PractitionerRole.period_end.is_(None))
            )
        )
        .scalars()
        .first()
    )
    assert role is not None
    cardio = (
        await db_session.execute(select(Specialism).where(Specialism.code == "cardiology"))
    ).scalar_one()
    db_session.add(
        PractitionerRoleSpecialism(
            practitioner_role_id=role.id,
            specialism_id=cardio.id,
            tenant_id=patients[0].tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
        )
    )
    await db_session.commit()
    await reconcile_all(db_session, fake_keto)

    await _login(async_client, CAREGIVER_EMAIL)
    assert (await async_client.get(f"/pathways/{scoped.id}")).status_code == 200
    listed = await async_client.get("/pathways")
    assert "Hartrevalidatie (scoped)" in {p["name"] for p in listed.json()}


async def test_admin_bypasses_carepath_scoping(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_access_domain
    scoped, _ = await _seed_pathways(
        db_session, patients[0].tenant_id, caregiver_email=CAREGIVER_EMAIL
    )
    await reconcile_all(db_session, fake_keto)

    await _login(async_client, ADMIN_EMAIL)
    assert (await async_client.get(f"/pathways/{scoped.id}")).status_code == 200
