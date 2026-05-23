"""seed luscii programs

Insert the 4 synthetic Luscii programs into `luscii_program`:

- ``luscii-hartfalen-monitoring-v4``
- ``luscii-copd-self-management-v2``
- ``luscii-diabetes-coaching-v6``
- ``luscii-rugrevalidatie-monitoring-v0``

The payloads come from :mod:`app.adapters.luscii.seed`. We dump each
``LusciiProgramData`` to JSON-mode and upsert into the table — making
the migration safe to re-run alongside ``moon run backend:seed-luscii``
(which uses the same source module).

All synthetic — no real patient data, no real Luscii ids.

Revision ID: 8d4c2e6b1f30
Revises: 2a7e1d3f9c01
Create Date: 2026-05-23 01:15:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, insert

from app.adapters.luscii.seed import LUSCII_STUB_PROGRAMS

revision: str = "8d4c2e6b1f30"
down_revision: str | None = "2a7e1d3f9c01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Local copy of the column shape so the migration does not import the ORM
# model directly (keeps the migration runnable even if the model later
# moves / renames).
_luscii_program = sa.table(
    "luscii_program",
    sa.column("id", sa.Text()),
    sa.column("data", JSONB()),
)


def upgrade() -> None:
    bind = op.get_bind()
    rows = [
        {"id": program.id, "data": program.model_dump(mode="json")}
        for program in LUSCII_STUB_PROGRAMS
    ]
    stmt = (
        insert(_luscii_program)
        .values(rows)
        .on_conflict_do_update(
            index_elements=["id"],
            set_={
                "data": sa.text("EXCLUDED.data"),
                "updated_at": sa.text("now()"),
            },
        )
    )
    bind.execute(stmt)


def downgrade() -> None:
    bind = op.get_bind()
    ids = [program.id for program in LUSCII_STUB_PROGRAMS]
    bind.execute(
        sa.text("DELETE FROM luscii_program WHERE id = ANY(:ids)").bindparams(ids=ids)
    )
