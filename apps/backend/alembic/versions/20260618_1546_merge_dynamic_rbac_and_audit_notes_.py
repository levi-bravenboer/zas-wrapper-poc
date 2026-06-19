"""merge dynamic-rbac and audit-notes-luscii heads

Revision ID: b72baef77788
Revises: rbacr0les0001, 49b272b9b8ef
Create Date: 2026-06-18 15:46:16.953227

"""

from __future__ import annotations

from collections.abc import Sequence


revision: str = "b72baef77788"
down_revision: str | None = ("rbacr0les0001", "49b272b9b8ef")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
