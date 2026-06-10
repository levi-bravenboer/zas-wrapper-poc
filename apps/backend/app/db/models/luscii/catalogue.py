# Local copy of the Luscii localisation catalogues (luscii-patient-enrichment).
#
# The public API exposes these only as unfiltered org-wide lists (measured
# 2026-06-10: 15.6k instrument-localisations, 40k+ item- and response-
# localisations at perPage=100 max) — far too large to fetch per request.
# `scripts/sync_luscii_catalogue.py` full-replaces these tables; the
# patient-data decoder reads them with key-filtered selects. Vendor reference
# data: no tenant scope, no PII, no audit actors, hard-deleted on re-sync.

from __future__ import annotations

from typing import ClassVar

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Entity


class LusciiInstrumentLocalisationRow(Entity):
    __tablename__ = "luscii_instrument_localisations"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "instrument_id",
            "instrument_version",
            "locale",
            name="uq_luscii_instrument_locs_key",
        ),
    )

    instrument_id: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
    instrument_version: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    locale: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    name: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    unit: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)


class LusciiInstrumentItemLocalisationRow(Entity):
    __tablename__ = "luscii_instrument_item_localisations"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "item_id",
            "item_version",
            "locale",
            name="uq_luscii_item_locs_key",
        ),
    )

    item_id: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
    item_version: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    locale: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    title: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    subtitle: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    unit: Mapped[str | None] = mapped_column(sa.String(64), nullable=True)


class LusciiItemResponseLocalisationRow(Entity):
    __tablename__ = "luscii_item_response_localisations"
    __realtime_resource__: ClassVar[str | None] = None
    __table_args__ = (
        sa.UniqueConstraint(
            "item_response_id",
            "locale",
            name="uq_luscii_response_locs_key",
        ),
    )

    item_response_id: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
    locale: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    response_text: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
