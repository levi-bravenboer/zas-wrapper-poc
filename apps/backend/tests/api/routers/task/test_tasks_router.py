from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums.task import TaskStatus
from app.db.audit import SESSION_ACTOR_KEY
from app.db.models.task import Task
from app.db.models.user import User
from app.repositories.task import TaskRepository
from app.services.task.task_service import TaskService
from httpx import AsyncClient
from scripts.seed_users import ADMIN_EMAIL, CAREGIVER_EMAIL
from tests._rbac import make_session_user

_PASSWORD = "changeme"


async def _login(client: AsyncClient, email: str) -> None:
    response = await client.post(
        "/auth/login/password", json={"email": email, "password": _PASSWORD}
    )
    assert response.status_code == 200, response.text


def _user(users: list[User], email: str) -> User:
    return next(u for u in users if u.email == email)


async def _create_task(
    session: AsyncSession, *, actor: User, assignee: User, title: str = "Taak"
) -> Task:
    previous = session.info.get(SESSION_ACTOR_KEY)
    session.info[SESSION_ACTOR_KEY] = make_session_user(
        id=actor.id,
        email=actor.email,
        display_name=actor.display_name,
        tenant_id=actor.tenant_id,
        role_id=actor.role_id,
    )
    try:
        service = TaskService(TaskRepository(session), session)
        task = await service.create(assignee_user_id=assignee.id, title=title)
        await session.commit()
        return task
    finally:
        if previous is None:
            session.info.pop(SESSION_ACTOR_KEY, None)
        else:
            session.info[SESSION_ACTOR_KEY] = previous


async def test_caregiver_sees_only_assigned_tasks(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_users: list[User]
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    await _create_task(db_session, actor=admin, assignee=caregiver, title="Voor caregiver")
    await _create_task(db_session, actor=admin, assignee=admin, title="Voor admin")

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Voor caregiver"
    assert body["items"][0]["assignee_user_id"] == str(caregiver.id)


async def test_empty_inbox(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_users: list[User]
) -> None:
    del db_session
    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 0


async def test_admin_sees_tenant_wide(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_users: list[User]
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    await _create_task(db_session, actor=admin, assignee=caregiver)
    await _create_task(db_session, actor=admin, assignee=admin)

    await _login(async_client, ADMIN_EMAIL)
    response = await async_client.get("/tasks")
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 2


async def test_close_task_via_status_patch(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_users: list[User]
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    caregiver = _user(seeded_zas_users, CAREGIVER_EMAIL)
    task = await _create_task(db_session, actor=admin, assignee=caregiver)

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.patch(f"/tasks/{task.id}", json={"status": "done"})
    assert response.status_code == 200, response.text
    assert response.json()["status"] == TaskStatus.DONE.value


async def test_caregiver_cannot_get_others_task(
    async_client: AsyncClient, db_session: AsyncSession, seeded_zas_users: list[User]
) -> None:
    admin = _user(seeded_zas_users, ADMIN_EMAIL)
    task = await _create_task(db_session, actor=admin, assignee=admin)

    await _login(async_client, CAREGIVER_EMAIL)
    response = await async_client.get(f"/tasks/{task.id}")
    assert response.status_code == 404
