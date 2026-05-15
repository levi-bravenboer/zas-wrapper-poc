from __future__ import annotations

from app.db.models.patient import Patient

# `patients` is a clinical-subject table. The mere presence of any of the
# columns below would re-open the credential / session attack surface this
# table is structurally designed to avoid. Guarded here so a future schema
# tweak that drifts back toward "Patient as User" is caught at code review.
_FORBIDDEN_COLUMN_PREFIXES = (
    "password",
    "auth_provider",
    "session_",
    "last_login",
    "mfa_",
)


def test_patients_table_has_no_credential_columns() -> None:
    table_columns = {column.name for column in Patient.__table__.columns}
    offenders = {
        name
        for name in table_columns
        if any(name.startswith(prefix) for prefix in _FORBIDDEN_COLUMN_PREFIXES)
    }
    assert offenders == set(), (
        f"`patients` carries credential-like columns: {sorted(offenders)} — "
        "this table is a clinical subject, not an authenticatable identity"
    )
