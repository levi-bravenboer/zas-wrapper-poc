"""observations composite value

Adds optional second component to `observations` so a single row can carry a
composite measurement (e.g. blood pressure: `value` = systolic,
`value_secondary` = diastolic, `secondary_code` = LOINC code for the second
component, `secondary_unit` = its unit). Existing single-value rows keep
`value_secondary` NULL and are unaffected.

Revision ID: d4e7f81a92b3
Revises: c0a8eaf41b62
Create Date: 2026-06-23 23:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4e7f81a92b3"
down_revision: str | None = "c0a8eaf41b62"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("observations", sa.Column("value_secondary", sa.Numeric(12, 3), nullable=True))
    op.add_column("observations", sa.Column("secondary_code", sa.String(64), nullable=True))
    op.add_column("observations", sa.Column("secondary_unit", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("observations", "secondary_unit")
    op.drop_column("observations", "secondary_code")
    op.drop_column("observations", "value_secondary")
