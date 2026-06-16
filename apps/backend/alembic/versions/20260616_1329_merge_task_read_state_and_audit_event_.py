"""merge task_read_state and audit_event heads

Revision ID: cab2e2caecfa
Revises: a7c3e9b1f204, 616885b6ce72
Create Date: 2026-06-16 13:29:56.904996

"""
from __future__ import annotations

from collections.abc import Sequence


revision: str = 'cab2e2caecfa'
down_revision: str | None = ('a7c3e9b1f204', '616885b6ce72')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
