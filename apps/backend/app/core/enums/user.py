"""User-domain enums.

`Role` is a Postgres-backed enum (created via `alembic-postgresql-enum`). The
Python side is a `StrEnum` so values round-trip cleanly through JSON and
query params without explicit conversion.
"""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    CAREGIVER = "caregiver"
    EXTERNAL = "external"
