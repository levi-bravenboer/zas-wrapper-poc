"""organisations base

Revision ID: 340430029268
Revises: f2e49e3d3c14
Create Date: 2026-05-15 12:08:16.820206

Creates the FHIR-aligned `organisations` table (self-referencing parent FK,
`CodeableConcept`-shape type columns), adds NULLABLE `users.organisation_id`
FK, and drops the `external` value from the `role` Postgres enum (now
`admin | caregiver`). `users.organisation_id` stays NULLABLE at the DB
level to break the bootstrap chicken-and-egg cycle with the audit FKs —
see `app/db/models/user/user.py` for the rationale. The service layer
enforces non-NULL on application-created users.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "340430029268"
down_revision: str | None = "f2e49e3d3c14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ORGANISATION_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/organization-type"


def upgrade() -> None:
    op.create_table(
        "organisations",
        sa.Column("parent_organisation_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type_code", sa.String(length=64), nullable=False),
        sa.Column(
            "type_system",
            sa.String(length=255),
            server_default=sa.text(f"'{ORGANISATION_TYPE_SYSTEM}'"),
            nullable=True,
        ),
        sa.Column("type_display", sa.String(length=255), nullable=True),
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
        sa.CheckConstraint(
            "parent_organisation_id IS NULL OR parent_organisation_id <> id",
            name="ck_organisations_parent_not_self",
        ),
        sa.ForeignKeyConstraint(
            ["parent_organisation_id"],
            ["organisations.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name="fk_organisations_created_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            name="fk_organisations_updated_by_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by"],
            ["users.id"],
            name="fk_organisations_deleted_by_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_organisations_tenant_id"), "organisations", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_organisations_parent_organisation_id"),
        "organisations",
        ["parent_organisation_id"],
        unique=False,
    )

    # users.organisation_id — NULLABLE (see module docstring for why).
    op.add_column("users", sa.Column("organisation_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_users_organisation_id_organisations",
        "users",
        "organisations",
        ["organisation_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(op.f("ix_users_organisation_id"), "users", ["organisation_id"], unique=False)

    # Drop `external` value from the `role` Postgres enum. Postgres has no
    # `ALTER TYPE ... DROP VALUE`, so rename → create new → cast → drop old.
    op.execute("ALTER TYPE role RENAME TO role_old")
    sa.Enum("admin", "caregiver", name="role").create(op.get_bind())
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE role USING role::text::role")
    op.execute("DROP TYPE role_old")


def downgrade() -> None:
    # Restore `external` value first so the column can hold it again.
    op.execute("ALTER TYPE role RENAME TO role_new")
    sa.Enum("admin", "caregiver", "external", name="role").create(op.get_bind())
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE role USING role::text::role")
    op.execute("DROP TYPE role_new")

    op.drop_index(op.f("ix_users_organisation_id"), table_name="users")
    op.drop_constraint("fk_users_organisation_id_organisations", "users", type_="foreignkey")
    op.drop_column("users", "organisation_id")

    op.drop_index(op.f("ix_organisations_parent_organisation_id"), table_name="organisations")
    op.drop_index(op.f("ix_organisations_tenant_id"), table_name="organisations")
    op.drop_table("organisations")
