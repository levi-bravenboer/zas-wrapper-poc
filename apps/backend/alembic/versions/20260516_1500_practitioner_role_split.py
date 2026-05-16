"""practitioner_role_split

Revision ID: f1a2b3c4d5e6
Revises: e705a2c0f85b
Create Date: 2026-05-16 15:00:00

Splits authentication identity (`User`) from clinical identity
(`Practitioner` + `PractitionerRole`). See `openspec/changes/practitioner-role-split/`.

Sequence:
1. Create `practitioners` + `practitioner_roles` tables (the latter implicitly
   creates the `practitioner_role_code` enum on first reference) and their
   indexes.
3. Add `care_team_participants.acting_as_practitioner_role_id` (nullable FK).
4. Backfill: one `Practitioner` per caregiver `User`; one open primary
   `PractitionerRole` row at `users.organisation_id`, `period_start =
   users.created_at`, `code = 'other'`.
5. Backfill `care_team_participants.acting_as_practitioner_role_id` from the
   legacy `on_behalf_of_organisation_id` column: resolve to the open role at
   that org; fall back to the primary open role; NULL when neither resolves.
6. Drop `users.organisation_id` (FK + index + column).
7. Drop `care_team_participants.on_behalf_of_organisation_id` (FK + column).

Downgrade restores both columns, re-backfills `users.organisation_id` from
each user's open primary `PractitionerRole` (and `on_behalf_of_organisation_id`
from `practitioner_roles.organisation_id`), then drops the new tables/enum.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "e705a2c0f85b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PRACTITIONER_ROLE_CODE_VALUES = (
    "gp",
    "physiotherapist",
    "psychologist",
    "nurse",
    "physician",
    "other",
)


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        "practitioners",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("family_name", sa.String(length=255), nullable=False),
        sa.Column("given_name", sa.String(length=255), nullable=False),
        sa.Column("qualification", sa.Text(), nullable=True),
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
    op.create_index("uq_practitioners_user_id", "practitioners", ["user_id"], unique=True)
    op.create_index(
        "ix_practitioners_tenant_id_family_name",
        "practitioners",
        ["tenant_id", "family_name"],
        unique=False,
    )
    op.create_index(op.f("ix_practitioners_tenant_id"), "practitioners", ["tenant_id"])

    op.create_table(
        "practitioner_roles",
        sa.Column("practitioner_id", sa.UUID(), nullable=False),
        sa.Column("organisation_id", sa.UUID(), nullable=False),
        sa.Column(
            "code",
            sa.Enum(*PRACTITIONER_ROLE_CODE_VALUES, name="practitioner_role_code"),
            nullable=False,
        ),
        sa.Column("specialty", sa.String(length=255), nullable=True),
        sa.Column(
            "is_primary",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "period_start",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["practitioner_id"], ["practitioners.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_practitioner_roles_practitioner_id"),
        "practitioner_roles",
        ["practitioner_id"],
    )
    op.create_index(
        op.f("ix_practitioner_roles_organisation_id"),
        "practitioner_roles",
        ["organisation_id"],
    )
    op.create_index(
        op.f("ix_practitioner_roles_tenant_id"),
        "practitioner_roles",
        ["tenant_id"],
    )
    op.create_index(
        "uq_practitioner_roles_open_affiliation",
        "practitioner_roles",
        ["practitioner_id", "organisation_id"],
        unique=True,
        postgresql_where=sa.text("period_end IS NULL"),
    )
    op.create_index(
        "uq_practitioner_roles_open_primary",
        "practitioner_roles",
        ["practitioner_id"],
        unique=True,
        postgresql_where=sa.text("is_primary AND period_end IS NULL"),
    )
    op.create_index(
        "ix_practitioner_roles_practitioner_open",
        "practitioner_roles",
        ["practitioner_id"],
        postgresql_where=sa.text("period_end IS NULL"),
    )
    op.create_index(
        "ix_practitioner_roles_organisation_open",
        "practitioner_roles",
        ["organisation_id"],
        postgresql_where=sa.text("period_end IS NULL"),
    )

    op.add_column(
        "care_team_participants",
        sa.Column("acting_as_practitioner_role_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_care_team_participants_acting_as_practitioner_role_id",
        "care_team_participants",
        "practitioner_roles",
        ["acting_as_practitioner_role_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # ----- Backfill caregiver Practitioner + PractitionerRole rows -----
    #
    # Splits `users.display_name` on the first space: everything before the
    # first space becomes `given_name`, the remainder becomes `family_name`.
    # Single-word display names become `(given='', family=<name>)`.
    bind.execute(
        sa.text(
            """
            INSERT INTO practitioners (
                id, tenant_id, user_id, family_name, given_name, qualification,
                created_by, updated_by, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                u.tenant_id,
                u.id,
                CASE
                    WHEN position(' ' IN u.display_name) > 0
                        THEN trim(substring(u.display_name FROM position(' ' IN u.display_name) + 1))
                    ELSE u.display_name
                END,
                CASE
                    WHEN position(' ' IN u.display_name) > 0
                        THEN substring(u.display_name FROM 1 FOR position(' ' IN u.display_name) - 1)
                    ELSE ''
                END,
                NULL,
                u.id,
                u.id,
                u.created_at,
                u.created_at
            FROM users u
            WHERE u.role = 'caregiver'
              AND u.deleted_at IS NULL
              AND u.organisation_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM practitioners p WHERE p.user_id = u.id
              )
            """
        )
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO practitioner_roles (
                id, tenant_id, practitioner_id, organisation_id, code,
                specialty, is_primary, period_start, period_end,
                created_by, updated_by, created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                p.tenant_id,
                p.id,
                u.organisation_id,
                'other',
                NULL,
                TRUE,
                u.created_at,
                NULL,
                u.id,
                u.id,
                u.created_at,
                u.created_at
            FROM practitioners p
            JOIN users u ON u.id = p.user_id
            WHERE u.organisation_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                    FROM practitioner_roles pr
                   WHERE pr.practitioner_id = p.id
                     AND pr.period_end IS NULL
              )
            """
        )
    )

    # ----- Backfill care_team_participants.acting_as_practitioner_role_id ---
    #
    # Resolution strategy (per spec):
    #   1. Exact match: same practitioner (user_id) + same organisation, open.
    #   2. Fallback: primary open role of the same practitioner.
    #   3. NULL otherwise.
    bind.execute(
        sa.text(
            """
            UPDATE care_team_participants ctp
               SET acting_as_practitioner_role_id = pr.id
              FROM practitioner_roles pr
              JOIN practitioners p ON p.id = pr.practitioner_id
             WHERE p.user_id = ctp.user_id
               AND pr.organisation_id = ctp.on_behalf_of_organisation_id
               AND pr.period_end IS NULL
               AND ctp.on_behalf_of_organisation_id IS NOT NULL
               AND ctp.acting_as_practitioner_role_id IS NULL
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE care_team_participants ctp
               SET acting_as_practitioner_role_id = pr.id
              FROM practitioner_roles pr
              JOIN practitioners p ON p.id = pr.practitioner_id
             WHERE p.user_id = ctp.user_id
               AND pr.is_primary
               AND pr.period_end IS NULL
               AND ctp.acting_as_practitioner_role_id IS NULL
            """
        )
    )

    # ----- Drop legacy columns -----
    op.drop_constraint(
        "care_team_participants_on_behalf_of_organisation_id_fkey",
        "care_team_participants",
        type_="foreignkey",
    )
    op.drop_column("care_team_participants", "on_behalf_of_organisation_id")

    op.drop_constraint(
        "fk_users_organisation_id_organisations",
        "users",
        type_="foreignkey",
    )
    op.drop_index("ix_users_organisation_id", table_name="users")
    op.drop_column("users", "organisation_id")


def downgrade() -> None:
    bind = op.get_bind()

    op.add_column(
        "users",
        sa.Column("organisation_id", sa.UUID(), nullable=True),
    )
    op.create_index("ix_users_organisation_id", "users", ["organisation_id"])
    op.create_foreign_key(
        "fk_users_organisation_id_organisations",
        "users",
        "organisations",
        ["organisation_id"],
        ["id"],
        ondelete="RESTRICT",
        use_alter=True,
    )
    bind.execute(
        sa.text(
            """
            UPDATE users u
               SET organisation_id = pr.organisation_id
              FROM practitioners p
              JOIN practitioner_roles pr ON pr.practitioner_id = p.id
             WHERE p.user_id = u.id
               AND pr.is_primary
               AND pr.period_end IS NULL
            """
        )
    )

    op.add_column(
        "care_team_participants",
        sa.Column("on_behalf_of_organisation_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "care_team_participants_on_behalf_of_organisation_id_fkey",
        "care_team_participants",
        "organisations",
        ["on_behalf_of_organisation_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    bind.execute(
        sa.text(
            """
            UPDATE care_team_participants ctp
               SET on_behalf_of_organisation_id = pr.organisation_id
              FROM practitioner_roles pr
             WHERE pr.id = ctp.acting_as_practitioner_role_id
            """
        )
    )

    op.drop_constraint(
        "fk_care_team_participants_acting_as_practitioner_role_id",
        "care_team_participants",
        type_="foreignkey",
    )
    op.drop_column("care_team_participants", "acting_as_practitioner_role_id")

    op.drop_index(
        "ix_practitioner_roles_organisation_open",
        table_name="practitioner_roles",
        postgresql_where=sa.text("period_end IS NULL"),
    )
    op.drop_index(
        "ix_practitioner_roles_practitioner_open",
        table_name="practitioner_roles",
        postgresql_where=sa.text("period_end IS NULL"),
    )
    op.drop_index(
        "uq_practitioner_roles_open_primary",
        table_name="practitioner_roles",
        postgresql_where=sa.text("is_primary AND period_end IS NULL"),
    )
    op.drop_index(
        "uq_practitioner_roles_open_affiliation",
        table_name="practitioner_roles",
        postgresql_where=sa.text("period_end IS NULL"),
    )
    op.drop_index(op.f("ix_practitioner_roles_tenant_id"), table_name="practitioner_roles")
    op.drop_index(op.f("ix_practitioner_roles_organisation_id"), table_name="practitioner_roles")
    op.drop_index(op.f("ix_practitioner_roles_practitioner_id"), table_name="practitioner_roles")
    op.drop_table("practitioner_roles")

    op.drop_index(op.f("ix_practitioners_tenant_id"), table_name="practitioners")
    op.drop_index("ix_practitioners_tenant_id_family_name", table_name="practitioners")
    op.drop_index("uq_practitioners_user_id", table_name="practitioners")
    op.drop_table("practitioners")

    sa.Enum(*PRACTITIONER_ROLE_CODE_VALUES, name="practitioner_role_code").drop(bind)
