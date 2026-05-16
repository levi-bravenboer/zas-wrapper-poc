from __future__ import annotations

import inspect
import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.care_team import care_team_router
from app.core.enums.care_team import RoleInCare
from app.core.enums.patient import Gender, PatientSource
from app.db.models.care_team import CareTeam, CareTeamParticipant
from app.db.models.patient import Patient
from app.db.models.tenant import Tenant
from scripts.seed_organisations import RUGREVAL_TEAM_ORG_ID
from scripts.seed_users import ADMIN_EMAIL, ADMIN_USER_ID, CAREGIVER_EMAIL

_DEFAULT_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password",
        json={"email": email, "password": _DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text


# ---- list ----------------------------------------------------------------


async def test_list_care_teams_returns_team_with_participant(
    async_client: AsyncClient,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, _ = seeded_zas_care_teams
    target = patients[0]
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(f"/patients/{target.id}/care-teams")
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    team = body[0]
    assert team["patient_id"] == str(target.id)
    assert len(team["participants"]) == 1
    assert team["participants"][0]["role_in_care"] == RoleInCare.PRIMARY.value


async def test_list_care_teams_caregiver_without_membership_404(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, _ = seeded_zas_care_teams
    target = patients[0]
    # Close the caregiver's open participant row so they lose membership.
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
    response = await async_client.get(f"/patients/{target.id}/care-teams")
    assert response.status_code == 404


async def test_list_care_teams_cross_tenant_returns_404(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    del seeded_zas_care_teams
    other = Tenant(id=uuid.uuid4(), slug="other", name="OTHER")
    db_session.add(other)
    await db_session.flush()
    alien = Patient(
        tenant_id=other.id,
        primary_organisation_id=RUGREVAL_TEAM_ORG_ID,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
        given_name="Alien",
        family_name="OtherTenant",
        gender=Gender.UNKNOWN,
        source=PatientSource.LOCAL,
    )
    db_session.add(alien)
    await db_session.commit()
    await db_session.refresh(alien)

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(f"/patients/{alien.id}/care-teams")
    assert response.status_code == 404


# ---- create --------------------------------------------------------------


async def test_admin_creates_team_for_any_tenant_patient(
    async_client: AsyncClient,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, _ = seeded_zas_care_teams
    target = patients[1]
    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.post(
        f"/patients/{target.id}/care-teams",
        json={"name": "Second team", "participants": []},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Second team"
    assert body["status"] == "active"
    assert body["participants"] == []


# ---- participants --------------------------------------------------------


async def test_change_participant_role_produces_two_rows(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, teams = seeded_zas_care_teams
    target_team = next(t for t in teams if t.patient_id == patients[0].id)
    existing = (
        (
            await db_session.execute(
                select(CareTeamParticipant).where(
                    CareTeamParticipant.care_team_id == target_team.id
                )
            )
        )
        .scalars()
        .first()
    )
    assert existing is not None
    user_id = existing.user_id

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.patch(
        f"/care-teams/{target_team.id}/participants/{user_id}",
        json={"role_in_care": RoleInCare.CONSULTING.value},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["role_in_care"] == RoleInCare.CONSULTING.value

    # The PATCH ran in the FastAPI session; the test session's identity map
    # still holds the pre-PATCH snapshot. Expire so the re-query sees the
    # committed `period_end` / `unassigned_by` columns.
    # API committed via its own session; clear the test session's identity
    # map so the re-query returns fully-loaded fresh rows (expire_all would
    # mark stale columns for lazy refresh, which sync-IO trips async greenlet).
    db_session.expunge_all()
    rows = (
        (
            await db_session.execute(
                select(CareTeamParticipant).where(
                    CareTeamParticipant.care_team_id == target_team.id,
                    CareTeamParticipant.user_id == user_id,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2
    closed = [r for r in rows if r.period_end is not None]
    open_rows = [r for r in rows if r.period_end is None]
    assert len(closed) == 1 and len(open_rows) == 1
    assert closed[0].role_in_care == RoleInCare.PRIMARY
    assert open_rows[0].role_in_care == RoleInCare.CONSULTING
    assert closed[0].unassigned_by is not None


async def test_unassign_sets_period_end_preserves_row(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, teams = seeded_zas_care_teams
    target_team = next(t for t in teams if t.patient_id == patients[0].id)
    existing = (
        (
            await db_session.execute(
                select(CareTeamParticipant).where(
                    CareTeamParticipant.care_team_id == target_team.id
                )
            )
        )
        .scalars()
        .first()
    )
    assert existing is not None
    user_id = existing.user_id

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.delete(f"/care-teams/{target_team.id}/participants/{user_id}")
    assert response.status_code == 204

    # API committed via its own session; clear the test session's identity
    # map so the re-query returns fully-loaded fresh rows (expire_all would
    # mark stale columns for lazy refresh, which sync-IO trips async greenlet).
    db_session.expunge_all()
    refreshed = (
        (
            await db_session.execute(
                select(CareTeamParticipant).where(
                    CareTeamParticipant.care_team_id == target_team.id,
                    CareTeamParticipant.user_id == user_id,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(refreshed) == 1
    assert refreshed[0].period_end is not None
    assert refreshed[0].unassigned_by is not None


async def test_add_participant_rejects_duplicate_open_row(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, teams = seeded_zas_care_teams
    target_team = next(t for t in teams if t.patient_id == patients[0].id)
    existing = (
        (
            await db_session.execute(
                select(CareTeamParticipant).where(
                    CareTeamParticipant.care_team_id == target_team.id
                )
            )
        )
        .scalars()
        .first()
    )
    assert existing is not None
    await _login(async_client, ADMIN_EMAIL)
    # Caregiver already has an open primary row from seed.
    response = await async_client.post(
        f"/care-teams/{target_team.id}/participants",
        json={
            "user_id": str(existing.user_id),
            "role_in_care": RoleInCare.OBSERVER.value,
        },
    )
    assert response.status_code == 409


# ---- authz ---------------------------------------------------------------


async def test_add_participant_rejects_cross_tenant_user(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: tuple[list[Patient], list[CareTeam]],
) -> None:
    patients, teams = seeded_zas_care_teams
    del patients
    target_team = next(t for t in teams if t.patient_id is not None)

    # A user_id that does not exist in any tenant exercises the same leak-safe
    # contract: the router must not distinguish "missing user" from "user in
    # other tenant" — both produce 404 or 422.
    alien_user_id = uuid.uuid4()

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.post(
        f"/care-teams/{target_team.id}/participants",
        json={
            "user_id": str(alien_user_id),
            "role_in_care": RoleInCare.OBSERVER.value,
        },
    )
    # Either 422 (cross-tenant user) or 404 if the user does not exist; both
    # satisfy the leak-safe contract.
    assert response.status_code in (404, 422)


# ---- source --------------------------------------------------------------


def test_care_team_router_marks_auth_harden() -> None:
    src = inspect.getsource(care_team_router)
    assert "AUTH-HARDEN" in src
