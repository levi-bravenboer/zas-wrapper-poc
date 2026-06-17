"""merge fhir audit columns and pr49 audit

Revision ID: bda68b3a235c
Revises: fhiraud1t0001, d4e8a1f3c206
Create Date: 2026-06-17 14:36:22.066518

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = 'bda68b3a235c'
down_revision: str | None = ('fhiraud1t0001', 'd4e8a1f3c206')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
