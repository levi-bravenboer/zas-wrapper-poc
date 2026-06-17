"""merge notes-unify and luscii-connections heads

Revision ID: dea5fb4a1b47
Revises: n0tef1les001, lscconn00001
Create Date: 2026-06-17 14:12:46.349317

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'dea5fb4a1b47'
down_revision: str | None = ('n0tef1les001', 'lscconn00001')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
