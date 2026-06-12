"""add informed consent block per-kind columns

Pathway-completion § A8: `InformedConsentBlock` per-kind nullable
columns on `pathway_block`. Single-table inheritance pattern (slot #1
D2): `informed_consent_*` prefix matches the `<KIND>_<field>` mapper
convention in `app/db/models/pathway/block_mapper.py`.

Revision ID: c0n5e4t8b1ck
Revises: t4r3a1tm2cnt
Create Date: 2026-06-12 09:30:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "c0n5e4t8b1ck"
down_revision: str | None = "t4r3a1tm2cnt"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pathway_block",
        sa.Column("informed_consent_questions", JSONB(), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column("informed_consent_channels", JSONB(), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column(
            "informed_consent_reminder_offset_iso",
            sa.String(length=63),
            nullable=True,
        ),
    )
    op.add_column(
        "pathway_block",
        sa.Column("informed_consent_reminder_max", sa.Integer(), nullable=True),
    )
    op.add_column(
        "pathway_block",
        sa.Column(
            "informed_consent_expires_at_iso",
            sa.String(length=63),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("pathway_block", "informed_consent_expires_at_iso")
    op.drop_column("pathway_block", "informed_consent_reminder_max")
    op.drop_column("pathway_block", "informed_consent_reminder_offset_iso")
    op.drop_column("pathway_block", "informed_consent_channels")
    op.drop_column("pathway_block", "informed_consent_questions")
