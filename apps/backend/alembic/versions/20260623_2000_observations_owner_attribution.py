"""observations owner attribution

Adds polymorphic owner addressing to `observations` (mirrors `notes`):

- `owner_type` (reuses the existing `owner_type` Postgres enum from `notes`).
- `owner_id` — the entity the measurement was recorded *on* (appointment,
  task, patient, pathway_step). Allows the patient aggregate to surface a
  source chip showing where each observation came from.

Existing rows are backfilled to `owner_type='patient', owner_id=patient_id`
so the new NOT NULL constraints succeed.

Revision ID: c0a8eaf41b62
Revises: a1f9c4d23b87
Create Date: 2026-06-23 20:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "c0a8eaf41b62"
down_revision: str | None = "a1f9c4d23b87"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Reuse the existing `owner_type` enum from the notes table — do NOT recreate.
_OWNER_TYPE = PG_ENUM(
    "appointment",
    "task",
    "patient",
    "pathway_step",
    name="owner_type",
    create_type=False,
)


def upgrade() -> None:
    op.add_column(
        "observations",
        sa.Column(
            "owner_type",
            _OWNER_TYPE,
            nullable=True,
            server_default=sa.text("'patient'"),
        ),
    )
    op.add_column(
        "observations",
        sa.Column("owner_id", PG_UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        "UPDATE observations SET owner_type = 'patient', owner_id = patient_id "
        "WHERE owner_id IS NULL"
    )
    op.alter_column("observations", "owner_type", nullable=False)
    op.alter_column("observations", "owner_id", nullable=False)
    op.create_index(
        "ix_observations_owner_open",
        "observations",
        ["owner_type", "owner_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_observations_owner_open", table_name="observations")
    op.drop_column("observations", "owner_id")
    op.drop_column("observations", "owner_type")
