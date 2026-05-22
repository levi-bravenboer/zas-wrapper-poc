"""create luscii_program table

Single jsonb-payload table keyed by Luscii's own program id. Both the
stub adapter (this change) and a future live adapter read/write here.

Schema is deliberately minimal — the payload shape can evolve with
Luscii's model without forcing migrations. The Pydantic schema in
`app.adapters.luscii.program.LusciiProgramData` is the application-level
contract.

Realtime: writes publish on the `luscii_program` topic (see
`LusciiProgram.__realtime_resource__`). The orchestrator's existing
`RealtimeInvalidationProvider` invalidates `['luscii_program', …]`
TanStack keys by key-prefix match.

Revision ID: 2a7e1d3f9c01
Revises: 35685b9389c1
Create Date: 2026-05-23 01:10:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "2a7e1d3f9c01"
down_revision: str | None = "35685b9389c1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "luscii_program",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("data", JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("luscii_program")
