"""Seed Luscii demo links + catalogue rows for `LusciiFixtureClient`.

Wires the first N seeded patients (`scripts/seed_patients.py`) to the
fixture-known Luscii UUIDs in `app/adapters/luscii/fixture.py`. Also
inserts the small set of localisation rows for the fixture's synthetic
instruments/items/responses so the catalogue decoder resolves labels +
units on the wire.

Idempotent: re-running the script is a no-op when the rows already exist.

Run: `python -m scripts.seed_luscii_demo`. Wired into `seed_all` AFTER
`seed_patients`; in production (token configured) the script is harmless
because the link rows just point at UUIDs the real Luscii API doesn't
recognise — `LusciiPatientNotFoundError` surfaces as a clear 502 if you
try to load that patient's data.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.luscii.fixture import (
    FIXTURE_PATIENTS,
    INSTRUMENT_LOCALISATIONS_NL,
    ITEM_LOCALISATIONS_NL,
    RESPONSE_LOCALISATIONS_NL,
)
from app.core.identifiers import LUSCII_PATIENT_SYSTEM
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.db.models.patient import Patient, PatientIdentifier
from scripts._db import run_script

logger = logging.getLogger(__name__)

FIXTURE_LOCALE = "nl"


async def seed_luscii_demo(session: AsyncSession) -> None:
    """Link the first N seeded patients to fixture Luscii UUIDs."""

    patients = list(
        await session.scalars(
            select(Patient)
            .where(Patient.deleted_at.is_(None))
            .order_by(Patient.external_ref)
            .limit(len(FIXTURE_PATIENTS))
        )
    )
    if not patients:
        logger.info("seed_luscii_demo: no patients found — run seed_patients first")
        return

    # The patient query already limits to `len(FIXTURE_PATIENTS)`; strict=True
    # surfaces a future fixture-vs-patient length drift instead of silently
    # skipping the tail of either list.
    pairs = list(zip(patients, FIXTURE_PATIENTS[: len(patients)], strict=True))
    for patient, (luscii_id, _seed) in pairs:
        await _link_patient(session, patient, luscii_id)

    await _seed_localisations(session)
    await session.flush()


async def _link_patient(session: AsyncSession, patient: Patient, luscii_id: str) -> None:
    existing = await session.scalar(
        select(PatientIdentifier).where(
            PatientIdentifier.patient_id == patient.id,
            PatientIdentifier.system == LUSCII_PATIENT_SYSTEM,
            PatientIdentifier.deleted_at.is_(None),
        )
    )
    if existing is not None:
        if existing.value == luscii_id:
            logger.info(
                "patient %s already linked to luscii %s", patient.external_ref, luscii_id
            )
            return
        # A previous run linked the patient to a different fixture id —
        # leave the existing link in place to keep the run idempotent.
        logger.info(
            "patient %s already linked to %s; not overriding", patient.external_ref, existing.value
        )
        return

    session.add(
        PatientIdentifier(
            patient_id=patient.id,
            system=LUSCII_PATIENT_SYSTEM,
            value=luscii_id,
            use="secondary",
        )
    )
    logger.info("linked patient %s to luscii %s", patient.external_ref, luscii_id)


async def _seed_localisations(session: AsyncSession) -> None:
    """Insert catalogue rows for the fixture's instruments/items/responses.

    Skips inserts when a row with the same natural key already exists —
    keeps the script idempotent + safe when the real catalogue snapshot
    already shipped a matching row (highly unlikely for the synthetic
    fixture UUIDs but cheap to guard).
    """

    for instrument_id, version, name in INSTRUMENT_LOCALISATIONS_NL:
        if await _row_exists(
            session,
            LusciiInstrumentLocalisationRow,
            instrument_id=instrument_id,
            instrument_version=version,
            locale=FIXTURE_LOCALE,
        ):
            continue
        session.add(
            LusciiInstrumentLocalisationRow(
                instrument_id=instrument_id,
                instrument_version=version,
                locale=FIXTURE_LOCALE,
                name=name,
            )
        )

    for item_id, version, title, unit in ITEM_LOCALISATIONS_NL:
        if await _row_exists(
            session,
            LusciiInstrumentItemLocalisationRow,
            item_id=item_id,
            item_version=version,
            locale=FIXTURE_LOCALE,
        ):
            continue
        session.add(
            LusciiInstrumentItemLocalisationRow(
                item_id=item_id,
                item_version=version,
                locale=FIXTURE_LOCALE,
                title=title,
                unit=unit,
            )
        )

    for response_id, text in RESPONSE_LOCALISATIONS_NL:
        if await _row_exists(
            session,
            LusciiItemResponseLocalisationRow,
            item_response_id=response_id,
            locale=FIXTURE_LOCALE,
        ):
            continue
        session.add(
            LusciiItemResponseLocalisationRow(
                item_response_id=response_id,
                locale=FIXTURE_LOCALE,
                response_text=text,
            )
        )


async def _row_exists(session: AsyncSession, model: type, **filters: object) -> bool:
    stmt = select(model)
    for column, value in filters.items():
        stmt = stmt.where(getattr(model, column) == value)
    return (await session.scalar(stmt.limit(1))) is not None


async def _seed(session: AsyncSession) -> None:
    await seed_luscii_demo(session)


def main() -> None:
    run_script(_seed)


if __name__ == "__main__":
    main()
