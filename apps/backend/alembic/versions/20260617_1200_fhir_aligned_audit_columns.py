"""fhir-aligned-audit-trail: CRUDE actions, patient actor, event_code,
patient_id, purpose_of_use

Additive only — extends `audit_action` / `actor_type` enums, adds the
`purpose_of_use` enum, three nullable columns, and two indexes. No backfill;
historical rows keep null event_code / patient_id / purpose_of_use.

Revision ID: fhiraud1t0001
Revises: md0outc0me01
Create Date: 2026-06-17 12:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "fhiraud1t0001"
down_revision: str | None = "md0outc0me01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PURPOSE_OF_USE_VALUES = (
    "treatment",
    "operations",
    "patient_request",
    "emergency",
    "break_the_glass",
)


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction — commit the
    # alembic-opened transaction, extend the enums, then re-open for DDL.
    # Repo precedent: 20260603_0619_add_patient_role_and_patient_id_to_users.py
    op.execute(sa.text("COMMIT"))
    op.execute(sa.text("ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'read'"))
    op.execute(sa.text("ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'execute'"))
    op.execute(sa.text("ALTER TYPE actor_type ADD VALUE IF NOT EXISTS 'patient'"))
    op.execute(sa.text("BEGIN"))

    sa.Enum(*PURPOSE_OF_USE_VALUES, name="purpose_of_use").create(op.get_bind())

    op.add_column("audit_events", sa.Column("event_code", sa.String(length=100), nullable=True))
    op.add_column("audit_events", sa.Column("patient_id", sa.UUID(), nullable=True))
    op.add_column(
        "audit_events",
        sa.Column(
            "purpose_of_use",
            postgresql.ENUM(*PURPOSE_OF_USE_VALUES, name="purpose_of_use", create_type=False),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_audit_events_patient",
        "audit_events",
        ["patient_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.create_index(
        "ix_audit_events_event_code",
        "audit_events",
        ["event_code", sa.text("created_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    # Enum VALUE additions to audit_action / actor_type are NOT reverted —
    # Postgres has no DROP VALUE; the extra values are harmless if unused.
    op.drop_index("ix_audit_events_event_code", table_name="audit_events")
    op.drop_index("ix_audit_events_patient", table_name="audit_events")
    op.drop_column("audit_events", "purpose_of_use")
    op.drop_column("audit_events", "patient_id")
    op.drop_column("audit_events", "event_code")
    sa.Enum(name="purpose_of_use").drop(op.get_bind())
