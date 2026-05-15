# Tenant is the root scoping entity for the backend. Every future domain table
# whose rows are owned by a hospital (users, pathways, patients, tasks, ...)
# MUST inherit `TenantOwnedEntity` (which FKs to `tenants.id`).
# The seeded `zas` UUID literal lives at `scripts.seed_tenant.ZAS_TENANT_ID` —
# import it from there in seed scripts and test fixtures rather than re-declaring.

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Entity

SLUG_REGEX = r"^[a-z][a-z0-9-]{0,62}$"


class Tenant(Entity):
    __tablename__ = "tenants"
    __table_args__ = (sa.CheckConstraint(f"slug ~ '{SLUG_REGEX}'", name="ck_tenants_slug_format"),)

    slug: Mapped[str] = mapped_column(sa.String(63), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
