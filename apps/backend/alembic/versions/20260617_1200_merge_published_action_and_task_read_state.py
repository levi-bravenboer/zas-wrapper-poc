"""merge published audit action and task_read_state heads

Converges the two heads created when this branch (the `published` AuditAction
migration, descending from the audit_event head) was rebased onto main (which
had already merged task_read_state with the audit_event head). No schema change.

Revision ID: d4e8a1f3c206
Revises: cab2e2caecfa, c1a7f0b93d52
Create Date: 2026-06-17 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

revision: str = "d4e8a1f3c206"
down_revision: str | tuple[str, ...] | None = ("cab2e2caecfa", "c1a7f0b93d52")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
