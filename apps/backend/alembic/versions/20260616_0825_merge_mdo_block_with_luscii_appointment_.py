"""merge mdo block with luscii appointment heads

Revision ID: f442e2bccbb7
Revises: m4d0b1l0ckk1, 2dd11b50fcb2
Create Date: 2026-06-16 08:25:15.045241

"""

from __future__ import annotations

from collections.abc import Sequence


revision: str = "f442e2bccbb7"
down_revision: str | None = ("m4d0b1l0ckk1", "2dd11b50fcb2")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
