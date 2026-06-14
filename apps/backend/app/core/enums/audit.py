"""Audit-trail enums.

All three are Postgres-backed enums (created via `alembic-postgresql-enum`);
the Python side is a `StrEnum` so values round-trip through JSON and query
params without explicit conversion.

`AuditAction` is the operation VERB only — the noun lives in the free-text
`resource_type` column. This keeps the enum small and slow-growing: auditing
a new model reuses `created` / `updated` / `deleted` with no enum migration.
Outcome is the orthogonal `AuditResult`, not a `login_failed` verb.
"""

from __future__ import annotations

from enum import StrEnum


class ActorType(StrEnum):
    USER = "user"
    SYSTEM = "system"
    SERVICE = "service"
    ANONYMOUS = "anonymous"


class AuditAction(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    LOGIN = "login"
    LOGOUT = "logout"
    EXPORTED = "exported"
    PUBLISHED = "published"
    ACCESS_GRANTED = "access_granted"


class AuditResult(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
