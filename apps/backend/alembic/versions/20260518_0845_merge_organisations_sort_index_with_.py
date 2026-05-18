"""merge organisations sort_index with pathway version

Revision ID: 6754e5c930ce
Revises: a1f5b9c2d4e7, 9a1c4f2d7e10
Create Date: 2026-05-18 08:45:53.082538

"""

from __future__ import annotations

from collections.abc import Sequence


revision: str = "6754e5c930ce"
down_revision: str | None = ("a1f5b9c2d4e7", "9a1c4f2d7e10")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
