"""Audit-trail enums.

All three are Postgres-backed enums (created via `alembic-postgresql-enum`);
the Python side is a `StrEnum` so values round-trip through JSON and query
params without explicit conversion.

`AuditAction` is the coarse FHIR R5 `AuditEvent.action` verb (C/R/U/D/E). The
most-specific event lives in the `event_code` column and the resource noun in
free-text `resource_type`, so the action set stays the fixed FHIR five and
never grows (a "publish" is `execute` + `event_code=pathway.published`, not a
bespoke verb). Outcome is the orthogonal `AuditResult`, not a `login_failed` verb.
"""

from __future__ import annotations

from enum import StrEnum


class ActorType(StrEnum):
    USER = "user"
    PATIENT = "patient"  # mobile-originated patient actor
    SYSTEM = "system"
    ANONYMOUS = "anonymous"


class AuditAction(StrEnum):
    CREATED = "created"  # FHIR C
    READ = "read"  # FHIR R
    UPDATED = "updated"  # FHIR U
    DELETED = "deleted"  # FHIR D
    EXECUTE = "execute"  # FHIR E — auth + runtime/domain events (incl. publish)
    LOGIN = "login"  # legacy; deprecated for new writes (use EXECUTE + event_code)


class AuditResult(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"


class PurposeOfUse(StrEnum):
    """FHIR `agent.authorization` / purposeOfUse. Required on patient-data reads."""

    TREATMENT = "treatment"
    OPERATIONS = "operations"
    PATIENT_REQUEST = "patient_request"
    EMERGENCY = "emergency"
    BREAK_THE_GLASS = "break_the_glass"
