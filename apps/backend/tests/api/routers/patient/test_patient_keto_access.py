"""Flag-on route tests: `require_patient_access` delegating to Keto.

The default suite runs with `AUTHZ_KETO_ENABLED=false` (regression path
covered by `test_patient_visibility.py`); these tests opt in via a local
settings fixture and populate the fake Keto through the real reconciler.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.practitioner_role import PractitionerRoleCode
from app.core.enums.user import Role
from app.core.settings import Settings
from app.db.models.care_team import CareTeam
from app.db.models.patient import Patient
from app.db.models.practitioner import Practitioner, PractitionerRole
from app.db.models.user import User
from app.services.access.identity.password import PasswordHasher
from app.services.access.sync.reconciler import reconcile_all
from scripts.seed_organisations import ZAS_ROOT_ORG_ID
from scripts.seed_users import ADMIN_EMAIL, ADMIN_USER_ID
from tests._settings import build_settings
from tests.conftest import TEST_DATABASE_URL
from tests.fakes.keto import FakeKetoClient

_DEFAULT_PASSWORD = "changeme"
SeededDomain = tuple[list[Patient], list[CareTeam]]


@pytest.fixture
def settings() -> Settings:
    """Override the suite default: relation checks via Keto are ON."""

    return build_settings(
        session_secret_key=SecretStr("test-secret"),
        database_url=TEST_DATABASE_URL,
        authz_keto_enabled=True,
    )


async def _login(client: AsyncClient, email: str, password: str = _DEFAULT_PASSWORD) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text


async def _seed_caregiver(
    db_session: AsyncSession,
    tenant_id: object,
    email: str,
) -> User:
    user = User(
        tenant_id=tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
        email=email,
        password_hash=PasswordHasher().hash(_DEFAULT_PASSWORD),
        display_name=email.split("@")[0],
        role=Role.CAREGIVER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_care_team_member_allowed(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_zas_care_teams
    await reconcile_all(db_session, fake_keto)

    await _login(async_client, "caregiver@zas.local")
    response = await async_client.get(f"/patients/{patients[0].id}")
    assert response.status_code == 200, response.text


async def test_unrelated_caregiver_gets_404(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_zas_care_teams
    outsider = await _seed_caregiver(db_session, patients[0].tenant_id, "outsider@zas.local")
    del outsider
    await db_session.commit()
    await reconcile_all(db_session, fake_keto)

    await _login(async_client, "outsider@zas.local")
    response = await async_client.get(f"/patients/{patients[0].id}")
    assert response.status_code == 404, response.text


async def test_org_ancestor_membership_allows(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_zas_care_teams
    chief = await _seed_caregiver(db_session, patients[0].tenant_id, "chief@zas.local")
    practitioner = Practitioner(
        tenant_id=chief.tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
        user_id=chief.id,
        given_name="Chief",
        family_name="Of-Root",
    )
    db_session.add(practitioner)
    await db_session.flush()
    db_session.add(
        PractitionerRole(
            tenant_id=chief.tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
            practitioner_id=practitioner.id,
            organisation_id=ZAS_ROOT_ORG_ID,
            code=PractitionerRoleCode.PHYSICIAN,
            is_primary=True,
        )
    )
    await db_session.commit()
    await reconcile_all(db_session, fake_keto)

    # Patient orgs sit two levels below ZAS root — membership at the root
    # must reach them through the parent chain.
    await _login(async_client, "chief@zas.local")
    response = await async_client.get(f"/patients/{patients[0].id}")
    assert response.status_code == 200, response.text


async def test_admin_bypasses_keto(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_zas_care_teams: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_zas_care_teams
    assert fake_keto.tuples == set()  # deliberately unpopulated

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get(f"/patients/{patients[0].id}")
    assert response.status_code == 200, response.text
