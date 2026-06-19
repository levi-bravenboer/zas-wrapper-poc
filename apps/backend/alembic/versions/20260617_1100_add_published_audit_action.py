"""add published audit action

Adds the `published` value to the native `audit_action` Postgres enum so the
pathway authoring trail can record version publishes (the one authoring action
that is not a create/update/delete). See change `pathway-audit`.

Revision ID: c1a7f0b93d52
Revises: a7c3e9b1f204
Create Date: 2026-06-17 11:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "c1a7f0b93d52"
down_revision: str | None = "a7c3e9b1f204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Native PG enum: a new label is appended with ALTER TYPE ... ADD VALUE.
    # `IF NOT EXISTS` keeps the migration idempotent. Postgres 12+ permits this
    # inside the migration transaction (the value just can't be *used* in the
    # same transaction, which we don't).
    op.execute("ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'published'")


def downgrade() -> None:
    # No-op by design. Postgres cannot drop a value from an enum type, and a
    # full type-rebuild (create a 4-value type, repoint the `audit_events.action`
    # column, drop + rename) would fail outright if any row already recorded a
    # `published` event. Leaving the extra label is harmless — nothing reads the
    # enum by ordinal — so the safe, reversible-in-practice downgrade is to do
    # nothing. Rebuild manually only if a clean rollback before any publish is
    # genuinely required.
    pass
