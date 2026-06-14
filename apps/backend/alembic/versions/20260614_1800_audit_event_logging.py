"""audit-event-logging

Revision ID: a7c3e9b1f204
Revises: 2dd11b50fcb2
Create Date: 2026-06-14 18:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a7c3e9b1f204"
down_revision: str | None = "2dd11b50fcb2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ACTOR_TYPE_VALUES = ("user", "system", "service", "anonymous")
AUDIT_ACTION_VALUES = (
    "created",
    "updated",
    "deleted",
    "login",
    "logout",
    "exported",
    "published",
    "access_granted",
)
AUDIT_RESULT_VALUES = ("success", "failure")


def upgrade() -> None:
    # Enum types created explicitly (then referenced with create_type=False on
    # the columns) so op.create_table does not create them a second time —
    # repo precedent: 20260611_1530_appointment_base.py.
    sa.Enum(*ACTOR_TYPE_VALUES, name="actor_type").create(op.get_bind())
    sa.Enum(*AUDIT_ACTION_VALUES, name="audit_action").create(op.get_bind())
    sa.Enum(*AUDIT_RESULT_VALUES, name="audit_result").create(op.get_bind())

    op.create_table(
        "audit_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "actor_type",
            postgresql.ENUM(*ACTOR_TYPE_VALUES, name="actor_type", create_type=False),
            nullable=False,
        ),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("actor_label", sa.String(length=255), nullable=True),
        sa.Column("tenant_id", sa.UUID(), nullable=True),
        sa.Column(
            "action",
            postgresql.ENUM(*AUDIT_ACTION_VALUES, name="audit_action", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "result",
            postgresql.ENUM(*AUDIT_RESULT_VALUES, name="audit_result", create_type=False),
            server_default=sa.text("'success'"),
            nullable=False,
        ),
        sa.Column("resource_type", sa.String(length=100), nullable=True),
        sa.Column("resource_id", sa.UUID(), nullable=True),
        sa.Column("request_id", sa.UUID(), nullable=True),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_events_resource",
        "audit_events",
        ["resource_type", "resource_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_audit_events_actor",
        "audit_events",
        ["actor_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_audit_events_tenant",
        "audit_events",
        ["tenant_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_audit_events_action_result",
        "audit_events",
        ["action", "result", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_audit_events_request",
        "audit_events",
        ["request_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_audit_events_request", table_name="audit_events")
    op.drop_index("ix_audit_events_action_result", table_name="audit_events")
    op.drop_index("ix_audit_events_tenant", table_name="audit_events")
    op.drop_index("ix_audit_events_actor", table_name="audit_events")
    op.drop_index("ix_audit_events_resource", table_name="audit_events")
    op.drop_table("audit_events")
    sa.Enum(name="audit_result").drop(op.get_bind())
    sa.Enum(name="audit_action").drop(op.get_bind())
    sa.Enum(name="actor_type").drop(op.get_bind())
