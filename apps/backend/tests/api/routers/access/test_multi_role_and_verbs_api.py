"""Multi-role session binding (REQ-NON-3/FUN-4) and external verb
separation (REQ-FUN-1/42) at the route level."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.practitioner_role import PractitionerRoleCode
from app.core.enums.user import Role
from app.db.models.access.consent import Consent
from app.db.models.access.external_access import ExternalAccessProfile, ExternalGrant
from app.db.models.care_team import CareTeam
from app.db.models.patient import Patient
from app.db.models.user import User
from app.services.access.identity.password import PasswordHasher
from app.services.access.sync.reconciler import reconcile_all
from scripts.seed_users import ADMIN_USER_ID
from tests.fakes.keto import FakeKetoClient

_PASSWORD = "changeme"
SeededDomain = tuple[list[Patient], list[CareTeam]]


def _user(tenant_id: object, email: str, role: Role, display: str) -> User:
    return User(
        tenant_id=tenant_id,
        created_by=ADMIN_USER_ID,
        updated_by=ADMIN_USER_ID,
        email=email,
        password_hash=PasswordHasher().hash(_PASSWORD),
        display_name=display,
        role=role,
        is_active=True,
    )


async def test_multi_role_login_requires_selection_then_binds(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
) -> None:
    patients, _ = seeded_access_domain
    tenant_id = patients[0].tenant_id
    db_session.add_all(
        [
            _user(tenant_id, "hoofdarts@zas.local", Role.CAREGIVER, "Hilde Hoofdarts"),
            _user(tenant_id, "hoofdarts@zas.local", Role.ADMIN, "Hilde Hoofdarts"),
        ]
    )
    await db_session.commit()

    login = await async_client.post(
        "/auth/login/password",
        json={"email": "hoofdarts@zas.local", "password": _PASSWORD},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["requires_role_selection"] is True
    assert set(body["available_roles"]) == {"admin", "caregiver"}

    # unbound session: protected routes answer 409, not 401 and not data
    me = await async_client.get("/auth/me")
    assert me.status_code == 409
    assert me.json()["code"] == "conflict.auth.role_selection_required"

    picked = await async_client.post("/auth/session/role", json={"role": "admin"})
    assert picked.status_code == 200, picked.text
    assert picked.json()["role"] == "admin"

    me = await async_client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["role"] == "admin"

    # mid-session switch: no re-authentication, next request acts as caregiver
    switched = await async_client.post("/auth/session/role", json={"role": "caregiver"})
    assert switched.status_code == 200
    me = await async_client.get("/auth/me")
    assert me.json()["role"] == "caregiver"


async def test_single_role_login_contract_unchanged(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
) -> None:
    login = await async_client.post(
        "/auth/login/password",
        json={"email": "caregiver@zas.local", "password": _PASSWORD},
    )
    assert login.status_code == 200
    body = login.json()
    assert "requires_role_selection" not in body
    assert body["role"] == "caregiver"
    assert (await async_client.get("/auth/me")).status_code == 200


async def test_role_not_available_rejected(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
) -> None:
    await async_client.post(
        "/auth/login/password",
        json={"email": "caregiver@zas.local", "password": _PASSWORD},
    )
    response = await async_client.post("/auth/session/role", json={"role": "admin"})
    assert response.status_code == 422
    assert response.json()["code"] == "invalid.auth.role_not_available"


async def test_external_verbs_read_but_not_write(
    async_client: AsyncClient,
    db_session: AsyncSession,
    seeded_access_domain: SeededDomain,
    fake_keto: FakeKetoClient,
) -> None:
    patients, _ = seeded_access_domain
    target = patients[0]
    external = _user(target.tenant_id, "huisarts@extern.be", Role.CAREGIVER, "Greet Huisarts")
    db_session.add(external)
    await db_session.flush()
    db_session.add(
        ExternalAccessProfile(
            professional_type=PractitionerRoleCode.GP,
            allow_read=True,
            allow_record=True,
            allow_write=False,
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
            user_id=external.id,
            professional_type=PractitionerRoleCode.GP,
            consent_id=consent.id,
            tenant_id=target.tenant_id,
            created_by=ADMIN_USER_ID,
            updated_by=ADMIN_USER_ID,
        )
    )
    await db_session.commit()
    await reconcile_all(db_session, fake_keto)

    login = await async_client.post(
        "/auth/login/password",
        json={"email": "huisarts@extern.be", "password": _PASSWORD},
    )
    assert login.status_code == 200

    # read allowed by the external_reader verb
    assert (await async_client.get(f"/patients/{target.id}")).status_code == 200
    # write denied: no external_writer verb → edit guard hides existence
    patch = await async_client.patch(f"/patients/{target.id}", json={"given_name": "Hacked"})
    assert patch.status_code == 404
