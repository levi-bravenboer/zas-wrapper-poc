from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.patient import Gender
from app.core.enums.permission import Permission
from app.db.models.patient import Patient
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID
from scripts.seed_practitioners import seed_practitioners
from scripts.seed_roles import DEFAULT_ROLE_SLUG
from scripts.seed_users import CAREGIVER_EMAIL
from tests._rbac import grant_to_role

_PW = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post("/auth/login/password", json={"email": email, "password": _PW})
    assert response.status_code == 200, response.text


def _body(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "given_name": "Nieuw",
        "family_name": "Patient",
        "gender": Gender.FEMALE.value,
    }
    base.update(overrides)
    return base


async def test_create_without_permission_is_forbidden(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        "/patients", json=_body(primary_organisation_id=str(RUGREVAL_TEAM_ORG_ID))
    )
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "forbidden.auth.permission"


async def test_create_cross_org_denied_without_cross_permission(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    # patient.create only (no createCrossOrg) and no practitioner affiliation, so
    # the caller has no own org — targeting any org is a cross-org attempt.
    await grant_to_role(
        db_session, role_slug=DEFAULT_ROLE_SLUG, permission=Permission.PATIENT_CREATE
    )
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        "/patients", json=_body(primary_organisation_id=str(RUGREVAL_TEAM_ORG_ID))
    )
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "forbidden.patient.create_cross_org"


async def test_create_defaults_to_own_org_and_makes_creator_a_member(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    # The caregiver is affiliated with exactly one org (RUGREVAL); patient.create
    # without createCrossOrg should auto-fill it when the body omits the org.
    await seed_practitioners(db_session)
    await db_session.commit()
    await grant_to_role(
        db_session, role_slug=DEFAULT_ROLE_SLUG, permission=Permission.PATIENT_CREATE
    )
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.post("/patients", json=_body())
    assert response.status_code == 201, response.text
    created = response.json()
    assert created["primary_organisation_id"] == str(RUGREVAL_TEAM_ORG_ID)

    # Creator joined the patient's care team → the new patient is now visible
    # in their (care-team-scoped) list.
    listing = await async_client.get("/patients")
    assert listing.status_code == 200, listing.text
    ids = [p["id"] for p in listing.json()["items"]]
    assert created["id"] in ids


async def test_me_organisations_returns_only_own_affiliations(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    await seed_practitioners(db_session)
    await db_session.commit()
    await _login(async_client, CAREGIVER_EMAIL)

    response = await async_client.get("/me/organisations")
    assert response.status_code == 200, response.text
    ids = [o["id"] for o in response.json()["items"]]
    assert ids == [str(RUGREVAL_TEAM_ORG_ID)]


async def test_me_organisations_without_cookie_returns_401(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get("/me/organisations")
    assert response.status_code == 401
