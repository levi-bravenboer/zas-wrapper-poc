"""User-domain enums.

`Role` is a Postgres-backed enum (created via `alembic-postgresql-enum`). The
Python side is a `StrEnum` so values round-trip cleanly through JSON and
query params without explicit conversion.

The `external` value was removed in `organisations-base`: the
internal-vs-external distinction is now derived from organisation-tree
membership via `app.services.organisation.predicates.is_external_for_root`.
"""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    CAREGIVER = "caregiver"
