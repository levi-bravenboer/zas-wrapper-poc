from __future__ import annotations

import inspect
import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.patient import patient_router
from app.core.enums.patient import Gender, PatientSource
from app.core.identifiers import INSZ_SYSTEM
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login", json={"email": email, "password": _DEFAULT_PASSWORD}
    )
    assert response.status_code == 200, response.text


def _valid_insz(yy: int = 1, mm: int = 1, dd: int = 1, serial: int = 1) -> str:
    serial9 = f"{yy:02d}{mm:02d}{dd:02d}{serial:03d}"
    check = 97 - (int("2" + serial9) % 97)
    return f"{serial9}{check:02d}"


# ---- list ----------------------------------------------------------------


async def test_list_patients_paginates(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/patients", params={"limit": 3, "offset": 0})
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 3
    assert body["meta"] == {"total": len(seeded_zas_patients), "limit": 3, "offset": 0}


async def test_list_patients_family_name_prefix(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/patients", params={"family_name": "Janss"})
    assert response.status_code == 200
    families = {row["family_name"] for row in response.json()["items"]}
    assert families == {"Janssens"}


async def test_list_patients_given_name_prefix(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/patients", params={"given_name": "Sve"})
    assert response.status_code == 200
    givens = {row["given_name"] for row in response.json()["items"]}
    assert givens == {"Sven"}


async def test_list_patients_birth_date_exact(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    target = next(p for p in seeded_zas_patients if p.given_name == "Sven")
    assert target.birth_date is not None
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(
        "/patients", params={"birth_date": target.birth_date.isoformat()}
    )
    assert response.status_code == 200
    ids = {row["id"] for row in response.json()["items"]}
    assert str(target.id) in ids


async def test_list_patients_identifier_short_circuits(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    target = seeded_zas_patients[0]
    insz = next(i for i in target.identifiers if i.system == INSZ_SYSTEM)
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(
        "/patients",
        params={"identifier": insz.value, "family_name": "ZZZ_no_match"},
    )
    assert response.status_code == 200
    body = response.json()
    assert [row["id"] for row in body["items"]] == [str(target.id)]


async def test_list_patients_and_filter_combination(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    target = next(p for p in seeded_zas_patients if p.given_name == "Sven")
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(
        "/patients",
        params={
            "given_name": target.given_name[:3],
            "family_name": target.family_name[:3],
        },
    )
    assert response.status_code == 200
    ids = {row["id"] for row in response.json()["items"]}
    assert str(target.id) in ids


async def test_list_patients_is_tenant_scoped(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_patients: list[Patient],
) -> None:
    other = Tenant(id=uuid.uuid4(), slug="other", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    alien = Patient(
        tenant_id=other.id,
        primary_organisation_id=RUGREVAL_TEAM_ORG_ID,  # FK satisfied; row is in other tenant
        created_by=seeded_zas_patients[0].created_by,
        updated_by=seeded_zas_patients[0].created_by,
        given_name="Alien",
        family_name="OtherTenant",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    db_session.add(alien)
    await db_session.commit()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/patients")
    assert response.status_code == 200
    families = {row["family_name"] for row in response.json()["items"]}
    assert "OtherTenant" not in families


# ---- create --------------------------------------------------------------


async def test_create_patient_returns_201_with_audit_columns(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    del seeded_zas_patients
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.post(
        "/patients",
        json={
            "primary_organisation_id": str(RUGREVAL_TEAM_ORG_ID),
            "given_name": "Nieuw",
            "family_name": "Patient",
            "gender": Gender.FEMALE.value,
            "birth_date": "2005-06-15",
            "identifiers": [{"system": INSZ_SYSTEM, "value": _valid_insz()}],
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["given_name"] == "Nieuw"
    assert len(body["identifiers"]) == 1
    assert body["identifiers"][0]["system"] == INSZ_SYSTEM


# ---- update --------------------------------------------------------------


async def test_patch_demographics_succeeds(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    target = seeded_zas_patients[0]
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.patch(f"/patients/{target.id}", json={"given_name": "Renamed"})
    assert response.status_code == 200
    assert response.json()["given_name"] == "Renamed"


async def test_patch_with_identifiers_returns_422(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    target = seeded_zas_patients[0]
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.patch(
        f"/patients/{target.id}",
        json={"identifiers": [{"system": INSZ_SYSTEM, "value": _valid_insz()}]},
    )
    assert response.status_code == 422


# ---- delete --------------------------------------------------------------


async def test_soft_delete_returns_204_then_404(
    async_client: AsyncClient, seeded_zas_patients: list[Patient]
) -> None:
    target = seeded_zas_patients[0]
    await _login(async_client, CAREGIVER_EMAIL)
    delete = await async_client.delete(f"/patients/{target.id}")
    assert delete.status_code == 204
    follow_up = await async_client.get(f"/patients/{target.id}")
    assert follow_up.status_code == 404


# ---- authz ---------------------------------------------------------------


async def test_list_patients_without_cookie_returns_401(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get("/patients")
    assert response.status_code == 401


async def test_get_cross_tenant_returns_404(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_patients: list[Patient],
) -> None:
    del seeded_zas_patients
    other = Tenant(id=uuid.uuid4(), slug="other", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    alien_created_by = uuid.UUID("00000000-0000-4000-8000-00000000ad11")
    alien = Patient(
        tenant_id=other.id,
        primary_organisation_id=RUGREVAL_TEAM_ORG_ID,
        created_by=alien_created_by,
        updated_by=alien_created_by,
        given_name="Alien",
        family_name="OtherTenant",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    db_session.add(alien)
    await db_session.commit()
    await db_session.refresh(alien)

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(f"/patients/{alien.id}")
    assert response.status_code == 404


# ---- source --------------------------------------------------------------


def test_router_source_marks_auth_harden() -> None:
    src = inspect.getsource(patient_router)
    assert "AUTH-HARDEN" in src
