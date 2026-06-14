"""merge luscii catalogue and appointment base

Revision ID: 2dd11b50fcb2
Revises: dc7013db3129, 9f3d2c8b5e41
Create Date: 2026-06-14 17:28:17.574217

"""

from __future__ import annotations

from collections.abc import Sequence


revision: str = "2dd11b50fcb2"
down_revision: str | None = ("dc7013db3129", "9f3d2c8b5e41")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
