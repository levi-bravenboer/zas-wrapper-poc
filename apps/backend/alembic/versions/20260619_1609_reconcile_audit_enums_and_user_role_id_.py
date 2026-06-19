"""reconcile audit enums and user role_id index

Brings the schema back in line with the models (alembic check drift):

- `users.role_id` gains the standalone index the model declares.
- `actor_type` / `audit_action` enum variants are re-synced. `audit_action`
  drops the legacy `published` label (the FHIR-audit rework records a publish
  as `execute` + `event_code = pathway.published`). Any lingering `published`
  rows are remapped to `execute` first so the type rebuild can't fail on a
  populated database.

Revision ID: e167e9701113
Revises: b72baef77788
Create Date: 2026-06-19 16:09:36.370084

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from alembic_postgresql_enum import TableReference

revision: str = 'e167e9701113'
down_revision: str | None = 'b72baef77788'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)
    op.sync_enum_values(
        enum_schema='public',
        enum_name='actor_type',
        new_values=['user', 'patient', 'system', 'anonymous'],
        affected_columns=[TableReference(table_schema='public', table_name='audit_events', column_name='actor_type')],
        enum_values_to_rename=[],
    )
    # Remap legacy `published` events before the label is dropped from the type.
    op.execute("UPDATE audit_events SET action = 'execute' WHERE action = 'published'")
    op.sync_enum_values(
        enum_schema='public',
        enum_name='audit_action',
        new_values=['created', 'read', 'updated', 'deleted', 'execute', 'login'],
        affected_columns=[TableReference(table_schema='public', table_name='audit_events', column_name='action')],
        enum_values_to_rename=[],
    )


def downgrade() -> None:
    op.sync_enum_values(
        enum_schema='public',
        enum_name='audit_action',
        new_values=['created', 'updated', 'deleted', 'login', 'published', 'read', 'execute'],
        affected_columns=[TableReference(table_schema='public', table_name='audit_events', column_name='action')],
        enum_values_to_rename=[],
    )
    op.sync_enum_values(
        enum_schema='public',
        enum_name='actor_type',
        new_values=['user', 'system', 'anonymous', 'patient'],
        affected_columns=[TableReference(table_schema='public', table_name='audit_events', column_name='actor_type')],
        enum_values_to_rename=[],
    )
    op.drop_index(op.f('ix_users_role_id'), table_name='users')
