# role ↔ permission assignment (`dynamic-rbac-roles-permissions`). One row per
# (role, permission-slug). `permission` is a code-catalog value (validated
# against `app.core.enums.Permission` at the service write boundary) stored as
# text — adding a permission is a code change, no enum migration (mirrors the
# audit `resource_type` rationale). CASCADE on role delete so purging an empty
# role drops its permissions (D13). Composite PK = uniqueness (role, permission).

from __future__ import annotations

from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        sa.ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permission: Mapped[str] = mapped_column(sa.String(64), primary_key=True)
