"""dynamic rbac roles and permissions

Revision ID: rbacr0les0001
Revises: n0tef1les001
Create Date: 2026-06-17 12:00:00.000000

Replaces the fixed `role` Postgres enum on `users` with dynamic, tenant-scoped
RBAC tables (`dynamic-rbac-roles-permissions`):

- `roles` (TenantOwnedEntity) + `role_permissions` (role ↔ permission-slug).
- Seeds two `is_system` roles per existing tenant: `admin` (full permission
  catalogue, incl. `patient.accessAll`) and `default` (`breakGlass.request`
  only). Role audit columns reuse the tenant's existing bootstrap admin user.
- Adds `users.role_id` (FK roles.id ON DELETE RESTRICT), backfills it from the
  legacy `role` enum (admin → admin role; everyone else → default role), then
  drops the legacy `role` column / indexes / CHECK and the `role` enum type.

DEPLOY NOTE: after deploy a superuser/admin must grant the `default` role its
app-action slugs; non-admins keep patient care (Keto) + `breakGlass.request`.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.enums.permission import Permission

revision: str = "rbacr0les0001"
down_revision: str | None = "n0tef1les001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Full catalogue granted to the seeded `admin` role; `default` gets only
# break-glass request. Code-defined on purpose (mirrors the model docs).
_ADMIN_PERMISSIONS: tuple[str, ...] = tuple(p.value for p in Permission)
_DEFAULT_PERMISSIONS: tuple[str, ...] = (Permission.BREAK_GLASS_REQUEST.value,)


def upgrade() -> None:
    # --- roles (Entity + tenant_id; no user-FK audit columns) ----------
    # Roles carry no created_by/updated_by/deleted_by: that would create a
    # bootstrap cycle (role.created_by → users, users.role_id → roles), and
    # roles are config. "Who changed a role" is captured in audit_events.
    op.create_table(
        "roles",
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_system", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
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
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_roles_tenant_slug"),
    )
    op.create_index(op.f("ix_roles_tenant_id"), "roles", ["tenant_id"], unique=False)

    # --- role_permissions (composite PK, CASCADE on role delete) -------
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.UUID(), nullable=False),
        sa.Column("permission", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("role_id", "permission"),
    )

    # --- seed admin + default roles per existing tenant ----------------
    op.execute(
        """
        INSERT INTO roles (id, tenant_id, slug, name, is_system)
        SELECT gen_random_uuid(), t.id, v.slug, v.name, true
        FROM tenants t
        CROSS JOIN (VALUES ('admin', 'Admin'), ('default', 'Default')) AS v(slug, name)
        """
    )

    # admin role gets the FULL catalogue.
    admin_values = ", ".join(f"('{p}')" for p in _ADMIN_PERMISSIONS)
    op.execute(
        f"""
        INSERT INTO role_permissions (role_id, permission)
        SELECT r.id, p.permission
        FROM roles r
        CROSS JOIN (VALUES {admin_values}) AS p(permission)
        WHERE r.slug = 'admin' AND r.is_system = true
        """
    )
    # default role gets only break-glass request.
    default_values = ", ".join(f"('{p}')" for p in _DEFAULT_PERMISSIONS)
    op.execute(
        f"""
        INSERT INTO role_permissions (role_id, permission)
        SELECT r.id, p.permission
        FROM roles r
        CROSS JOIN (VALUES {default_values}) AS p(permission)
        WHERE r.slug = 'default' AND r.is_system = true
        """
    )

    # --- users.role_id (nullable first, backfill, then NOT NULL) -------
    op.add_column("users", sa.Column("role_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_users_role_id_roles",
        source_table="users",
        referent_table="roles",
        local_cols=["role_id"],
        remote_cols=["id"],
        ondelete="RESTRICT",
    )

    # Backfill: legacy admins → tenant admin role; everyone else → default.
    op.execute(
        """
        UPDATE users u
        SET role_id = r.id
        FROM roles r
        WHERE r.tenant_id = u.tenant_id
          AND r.slug = 'admin'
          AND u.role = 'admin'
        """
    )
    op.execute(
        """
        UPDATE users u
        SET role_id = r.id
        FROM roles r
        WHERE r.tenant_id = u.tenant_id
          AND r.slug = 'default'
          AND u.role <> 'admin'
        """
    )

    op.alter_column("users", "role_id", existing_type=sa.UUID(), nullable=False)
    op.create_index("ix_users_tenant_id_role_id", "users", ["tenant_id", "role_id"], unique=False)

    # --- drop legacy role-based indexes / constraints ------------------
    op.drop_constraint("ck_users_role_patient_link", "users", type_="check")
    op.drop_index("uq_users_tenant_id_lower_email_role", table_name="users")
    op.drop_index("ix_users_tenant_id_role", table_name="users")
    op.drop_index(
        "uq_users_tenant_external_subject_role",
        table_name="users",
        postgresql_where=sa.text("external_subject IS NOT NULL"),
    )

    # --- new role_id-based partial unique indexes ----------------------
    op.create_index(
        "uq_users_tenant_lower_email_role_staff",
        "users",
        [sa.text("tenant_id"), sa.text("lower(email)"), sa.text("role_id")],
        unique=True,
        postgresql_where=sa.text("patient_id IS NULL"),
    )
    op.create_index(
        "uq_users_tenant_lower_email_patient",
        "users",
        [sa.text("tenant_id"), sa.text("lower(email)")],
        unique=True,
        postgresql_where=sa.text("patient_id IS NOT NULL"),
    )
    op.create_index(
        "uq_users_tenant_external_subject_role",
        "users",
        ["tenant_id", "external_idp", "external_subject", "role_id"],
        unique=True,
        postgresql_where=sa.text("external_subject IS NOT NULL"),
    )

    # --- drop the legacy `role` column + enum type ---------------------
    op.drop_column("users", "role")
    sa.Enum(name="role").drop(op.get_bind())

    # DEPLOY NOTE (also in module docstring): after deploy a superuser/admin
    # must grant the `default` role its app-action slugs; non-admins keep
    # patient care (Keto) + breakGlass.request.
    print(  # noqa: T201
        "[rbac migration] After deploy a superuser/admin must grant the "
        "`default` role its app-action slugs; non-admins keep patient care "
        "(Keto) + breakGlass.request."
    )


def downgrade() -> None:
    # Re-create the legacy `role` enum + column (best-effort reverse).
    sa.Enum("admin", "caregiver", "patient", name="role").create(op.get_bind())
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.Enum("admin", "caregiver", "patient", name="role", create_type=False),
            nullable=True,
        ),
    )

    # Backfill the enum from role slug: admin role → 'admin', else 'caregiver';
    # patient rows (patient_id set) → 'patient' regardless of role slug.
    op.execute(
        """
        UPDATE users u
        SET role = CASE
            WHEN u.patient_id IS NOT NULL THEN 'caregiver'::role
            WHEN r.slug = 'admin' THEN 'admin'::role
            ELSE 'caregiver'::role
        END
        FROM roles r
        WHERE r.id = u.role_id
        """
    )
    op.execute(
        "UPDATE users SET role = 'patient'::role WHERE patient_id IS NOT NULL"
    )
    op.alter_column("users", "role", existing_type=sa.Enum(name="role"), nullable=False)

    # Drop the new role_id-based indexes.
    op.drop_index(
        "uq_users_tenant_external_subject_role",
        table_name="users",
        postgresql_where=sa.text("external_subject IS NOT NULL"),
    )
    op.drop_index(
        "uq_users_tenant_lower_email_patient",
        table_name="users",
        postgresql_where=sa.text("patient_id IS NOT NULL"),
    )
    op.drop_index(
        "uq_users_tenant_lower_email_role_staff",
        table_name="users",
        postgresql_where=sa.text("patient_id IS NULL"),
    )
    op.drop_index("ix_users_tenant_id_role_id", table_name="users")

    # Re-create the legacy role-based indexes + CHECK.
    op.create_index(
        "uq_users_tenant_external_subject_role",
        "users",
        ["tenant_id", "external_idp", "external_subject", "role"],
        unique=True,
        postgresql_where=sa.text("external_subject IS NOT NULL"),
    )
    op.create_index("ix_users_tenant_id_role", "users", ["tenant_id", "role"], unique=False)
    op.create_index(
        "uq_users_tenant_id_lower_email_role",
        "users",
        [sa.text("tenant_id"), sa.text("lower(email)"), sa.text("role")],
        unique=True,
    )
    op.create_check_constraint(
        "ck_users_role_patient_link",
        "users",
        "(role = 'patient' AND patient_id IS NOT NULL)"
        " OR (role <> 'patient' AND patient_id IS NULL)",
    )

    # Drop role_id, then the RBAC tables.
    op.drop_constraint("fk_users_role_id_roles", "users", type_="foreignkey")
    op.drop_column("users", "role_id")

    op.drop_table("role_permissions")
    op.drop_index(op.f("ix_roles_tenant_id"), table_name="roles")
    op.drop_table("roles")
