"""real tasks domain; drop task_read_state

Revision ID: b2d4f6a8c0e2
Revises: a1c0d2e4f6b8
Create Date: 2026-06-16 14:30:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b2d4f6a8c0e2"
down_revision: str | None = "a1c0d2e4f6b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# create_type=False: the type lifecycle is managed explicitly via
# `.create()` / `.drop()`; without it `create_table` re-emits CREATE TYPE and
# the upgrade fails with "type task_status already exists".
_TASK_STATUS = postgresql.ENUM("open", "done", name="task_status", create_type=False)


def upgrade() -> None:
    # ── new real task domain ──
    _TASK_STATUS.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "tasks",
        sa.Column("assignee_user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", _TASK_STATUS, server_default=sa.text("'open'"), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("patient_id", sa.UUID(), nullable=True),
        sa.Column("source_ref", sa.String(length=255), nullable=True),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=False),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["assignee_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tasks_tenant_id"), "tasks", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_tasks_assignee_user_id"), "tasks", ["assignee_user_id"], unique=False)
    op.create_index(op.f("ix_tasks_patient_id"), "tasks", ["patient_id"], unique=False)
    op.create_index(
        "ix_tasks_assignee_status_open",
        "tasks",
        ["tenant_id", "assignee_user_id", "status"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ── drop the superseded appointment read-state ──
    op.drop_index(
        "uq_task_read_state_user_source_open",
        table_name="task_read_state",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(
        "ix_task_read_state_user_source",
        table_name="task_read_state",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(op.f("ix_task_read_state_user_id"), table_name="task_read_state")
    op.drop_index(op.f("ix_task_read_state_tenant_id"), table_name="task_read_state")
    op.drop_table("task_read_state")


def downgrade() -> None:
    op.create_table(
        "task_read_state",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column(
            "opened_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("updated_by", sa.UUID(), nullable=False),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_read_state_tenant_id"), "task_read_state", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_task_read_state_user_id"), "task_read_state", ["user_id"], unique=False
    )
    op.create_index(
        "ix_task_read_state_user_source",
        "task_read_state",
        ["user_id", "source"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "uq_task_read_state_user_source_open",
        "task_read_state",
        ["user_id", "source", "source_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.drop_index(
        "ix_tasks_assignee_status_open",
        table_name="tasks",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_index(op.f("ix_tasks_patient_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_assignee_user_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_tenant_id"), table_name="tasks")
    op.drop_table("tasks")
    _TASK_STATUS.drop(op.get_bind(), checkfirst=True)
