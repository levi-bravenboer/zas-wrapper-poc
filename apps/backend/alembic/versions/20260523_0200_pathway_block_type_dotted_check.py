"""enforce dotted block-type code shape

Add a CHECK constraint on ``pathway_block.type`` so the column accepts only
the two well-formed shapes:

- **Bare** native codes — e.g. ``appointment``, ``task``, ``pathway_link``.
- **Dotted** external-provider codes — e.g. ``luscii.program``.

Regex: ``^[a-z_]+(\\.[a-z_]+)?$``. Matches the application-level parser in
``app.domain.pathway.blocks.block_type_code.BlockTypeCode`` so the two stay
in lockstep. Application validation still enforces that the parsed code
resolves to an entry in the code-side ``BLOCK_TYPES`` catalogue; this
CHECK is a defence-in-depth shape guard for writes that bypass the API.

Revision ID: 5f1a8b3c9d24
Revises: 35685b9389c1
Create Date: 2026-05-23 02:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.domain.pathway import BLOCK_TYPE_CODE_PATTERN

revision: str = "5f1a8b3c9d24"
down_revision: str | None = "35685b9389c1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CONSTRAINT_NAME = "ck_pathway_block_type_format"
# Pull the regex from the application-side parser so the DB CHECK and the
# Python validator can never drift. `re.Pattern.pattern` is the raw string.
CONSTRAINT_EXPR = f"type ~ '{BLOCK_TYPE_CODE_PATTERN.pattern}'"


def upgrade() -> None:
    op.create_check_constraint(CONSTRAINT_NAME, "pathway_block", CONSTRAINT_EXPR)


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT_NAME, "pathway_block", type_="check")
