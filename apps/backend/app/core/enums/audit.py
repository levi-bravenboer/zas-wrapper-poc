"""Audit-trail enums.

All three are Postgres-backed enums (created via `alembic-postgresql-enum`);
the Python side is a `StrEnum` so values round-trip through JSON and query
params without explicit conversion.

`AuditAction` is the operation VERB only — the noun lives in the free-text
`resource_type` column. This keeps the enum small and slow-growing: auditing
a new model reuses `created` / `updated` / `deleted` with no enum migration.
A new verb is added ONLY for a state transition that cannot be expressed as
create/update/delete (e.g. `published`, the concept→published transition), and
such a verb stays generic and reusable across resource types rather than
resource-specific. Outcome is the orthogonal `AuditResult`, not a
`login_failed` verb.
"""

from __future__ import annotations

from enum import StrEnum


class ActorType(StrEnum):
    USER = "user"
    SYSTEM = "system"
    ANONYMOUS = "anonymous"


class AuditAction(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    LOGIN = "login"
    PUBLISHED = "published"


class AuditResult(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
