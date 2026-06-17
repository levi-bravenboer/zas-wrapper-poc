"""merge audit-columns and notes-luscii heads

Revision ID: 49b272b9b8ef
Revises: dea5fb4a1b47, bda68b3a235c
Create Date: 2026-06-17 22:40:52.440244

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '49b272b9b8ef'
down_revision: str | None = ('dea5fb4a1b47', 'bda68b3a235c')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
