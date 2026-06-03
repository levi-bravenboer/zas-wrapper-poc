"""merge nested-pathway-blocks with mobile-app-auth-setup

Revision ID: afb369f4671a
Revises: f66286821872, 7614fd4e8ece
Create Date: 2026-06-03 22:40:45.801253

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'afb369f4671a'
down_revision: str | None = ('f66286821872', '7614fd4e8ece')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
