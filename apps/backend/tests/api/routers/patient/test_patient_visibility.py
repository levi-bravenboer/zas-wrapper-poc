from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.patient import Gender, PatientSource
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.patient import Patient
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID
from scripts.seed_users import ADMIN_EMAIL, ADMIN_USER_ID, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password",
        json={"email": email, "password": _DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text


async def _list_visible_ids(client: AsyncClient) -> set[str]:
    response = await client.get("/patients", params={"page_size": 100})
    assert response.status_code == 200, response.text
    return {row["id"] for row in response.json()["items"]}


async def test_admin_sees_all_patients_regardless_of_membership(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, _ = seeded_zas_care_teams
    orphan = Patient(
        tenant_id=patients[0].tenant_id,
        primary_organisation_id=RUGREVAL_TEAM_ORG_ID,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
        given_name="Orphan",
        family_name="NoTeam",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    db_session.add(orphan)
    await db_session.commit()
    await db_session.refresh(orphan)

    await _login(async_client, ADMIN_EMAIL)
    ids = await _list_visible_ids(async_client)
    for p in patients:
        assert str(p.id) in ids
    assert str(orphan.id) in ids


async def test_caregiver_sees_only_patients_with_open_membership(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, _ = seeded_zas_care_teams
    orphan = Patient(
        tenant_id=patients[0].tenant_id,
        primary_organisation_id=RUGREVAL_TEAM_ORG_ID,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
        given_name="Orphan",
        family_name="NoTeam",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    db_session.add(orphan)
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    ids = await _list_visible_ids(async_client)
    for p in patients:
        assert str(p.id) in ids
    assert str(orphan.id) not in ids


async def test_caregiver_loses_visibility_after_membership_closes(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, _ = seeded_zas_care_teams
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
    for row in rows:
        row.period_end = row.period_start
        row.unassigned_by = ADMIN_USER_ID
    await db_session.commit()

    await _login(async_client, CAREGIVER_EMAIL)
    ids = await _list_visible_ids(async_client)
    assert str(target.id) not in ids
    for other in patients[1:]:
        assert str(other.id) in ids
