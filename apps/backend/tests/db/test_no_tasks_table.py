from __future__ import annotations

import importlib

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base


def test_no_tasks_orm_model_registered() -> None:
    assert "tasks" not in Base.metadata.tables


def test_no_task_orm_class() -> None:
    models = importlib.import_module("app.db.models")
    assert not hasattr(models, "Task")


async def test_no_tasks_table_in_db(db_session: AsyncSession) -> None:
    rows = (
        await db_session.execute(
            text("SELECT to_regclass('public.tasks')")
        )
    ).scalar_one()
    assert rows is None


async def test_no_task_postgres_enums(db_session: AsyncSession) -> None:
    for enum_name in ("task_kind", "task_status", "task_priority"):
        rows = (
            await db_session.execute(
                text("SELECT 1 FROM pg_type WHERE typname = :n"),
                {"n": enum_name},
            )
        ).fetchone()
        assert rows is None, f"Unexpected Postgres enum {enum_name}"


@pytest.mark.parametrize(
    "module_path",
    [
        "app.adapters.hix.tasks",
        "app.services.task.task_service",
    ],
)
def test_no_task_service_or_adapter_modules(module_path: str) -> None:
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module(module_path)
