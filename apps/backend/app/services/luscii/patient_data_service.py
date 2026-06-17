"""Patient↔Luscii linking + the merged live patient-data payload.

Live proxy (luscii-patient-enrichment design D3): patient data (details,
planned actions, measurements) is fetched live on every call; nothing is
persisted except the link identifier row. Measurement labels resolve against
the locally synced catalogue tables (see `catalogue_sync.py` — the public
API cannot serve the 95k-row catalogues per request). Display-only
invariant: this module joins and decodes Luscii fields, it never computes
thresholds, scores, or any value-derived clinical signal.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any, TypeVar
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.luscii import (
    LusciiApiError,
    LusciiClient,
    LusciiMeasurement,
    LusciiMeasurementDetailItem,
    LusciiPatientDetails,
    LusciiPatientNotFoundError,
    LusciiPlannedAction,
)
from app.core.enums.patient import LusciiConnectionStatus
from app.db.models.luscii import (
    LusciiInstrumentItemLocalisationRow,
    LusciiInstrumentLocalisationRow,
    LusciiItemResponseLocalisationRow,
)
from app.db.models.patient import Patient, PatientLusciiConnection
from app.schemas.luscii.patient_data import (
    ConnectionGroup,
    LusciiLinkResult,
    LusciiMeasurementValueView,
    LusciiMeasurementView,
    LusciiPatientData,
    LusciiPlannedActionView,
    LusciiProgramView,
    LusciiProtocolView,
)
from app.services.luscii.archetype import classify_archetype
from app.services.luscii.errors import (
    LusciiIdAlreadyLinkedError,
    LusciiLinkPatientNotFoundError,
    LusciiNotConfiguredError,
    LusciiUnavailableError,
)
from app.services.luscii.series import project_series

logger = logging.getLogger(__name__)

PREFERRED_LOCALE = "nl"

_V = TypeVar("_V")


class LusciiPatientDataService:
    def __init__(self, session: AsyncSession, client: LusciiClient | None) -> None:
        self._session = session
        self._client = client

    # -- linking ------------------------------------------------------------

    async def link(self, patient: Patient, luscii_patient_id: UUID) -> LusciiLinkResult:
        client = self._require_client()
        value = str(luscii_patient_id)
        try:
            details = await client.get_patient(value)
        except LusciiPatientNotFoundError as exc:
            raise LusciiLinkPatientNotFoundError(details={"luscii_patient_id": value}) from exc
        except LusciiApiError as exc:
            raise LusciiUnavailableError() from exc

        # One Luscii patient maps to at most one of ours while active.
        other = await self._session.scalar(
            select(PatientLusciiConnection.patient_id).where(
                PatientLusciiConnection.luscii_patient_id == luscii_patient_id,
                PatientLusciiConnection.status == LusciiConnectionStatus.ACTIVE,
                PatientLusciiConnection.deleted_at.is_(None),
                PatientLusciiConnection.patient_id != patient.id,
            )
        )
        if other is not None:
            raise LusciiIdAlreadyLinkedError()

        program = details.program
        program_id = program.id if program else None
        program_name = program.name if program else None

        # Replacement semantics (single active per patient until the
        # multi-connection UI lands): deactivate the current active
        # connection, then upsert the target to active. Re-link reuses the
        # existing `(patient, luscii patient)` row so history is not duplicated.
        await self._deactivate_active_connections(patient.id)
        existing = await self._session.scalar(
            select(PatientLusciiConnection).where(
                PatientLusciiConnection.patient_id == patient.id,
                PatientLusciiConnection.luscii_patient_id == luscii_patient_id,
                PatientLusciiConnection.deleted_at.is_(None),
            )
        )
        if existing is not None:
            existing.status = LusciiConnectionStatus.ACTIVE
            existing.program_id = program_id
            existing.program_name = program_name
        else:
            self._session.add(
                PatientLusciiConnection(
                    patient_id=patient.id,
                    luscii_patient_id=luscii_patient_id,
                    status=LusciiConnectionStatus.ACTIVE,
                    program_id=program_id,
                    program_name=program_name,
                )
            )
        await self._session.flush()
        return LusciiLinkResult(
            luscii_patient_id=luscii_patient_id,
            program_name=program_name,
            protocol_name=details.protocol.name if details.protocol else None,
        )

    async def unlink(self, patient: Patient) -> None:
        """Idempotent: deactivates the active connection(s), keeps the rows."""
        await self._deactivate_active_connections(patient.id)
        await self._session.flush()

    async def _deactivate_active_connections(self, patient_id: UUID) -> None:
        rows = await self._session.scalars(
            select(PatientLusciiConnection).where(
                PatientLusciiConnection.patient_id == patient_id,
                PatientLusciiConnection.status == LusciiConnectionStatus.ACTIVE,
                PatientLusciiConnection.deleted_at.is_(None),
            )
        )
        for row in rows:
            row.status = LusciiConnectionStatus.INACTIVE

    async def active_link_value(self, patient_id: UUID) -> str | None:
        luscii_id = await self._session.scalar(
            select(PatientLusciiConnection.luscii_patient_id)
            .where(
                PatientLusciiConnection.patient_id == patient_id,
                PatientLusciiConnection.status == LusciiConnectionStatus.ACTIVE,
                PatientLusciiConnection.deleted_at.is_(None),
            )
            .limit(1)
        )
        return str(luscii_id) if luscii_id is not None else None

    # -- aggregation ----------------------------------------------------------

    async def get_patient_data(self, patient: Patient, days: int) -> LusciiPatientData:
        connections = await self._active_connections(patient.id)
        if not connections:
            return LusciiPatientData(state="not_linked", window_days=days)

        client = self._require_client()
        end = datetime.now(UTC).date()
        start = end - timedelta(days=days)
        luscii_ids = [str(c.luscii_patient_id) for c in connections]
        try:
            # One org-wide measurements call; per-connection details + planned
            # actions in parallel.
            measurements = await client.get_measurements(start, end)
            details_list, actions_list = await asyncio.gather(
                asyncio.gather(*(client.get_patient(v) for v in luscii_ids)),
                asyncio.gather(*(client.get_planned_actions(v, start, end) for v in luscii_ids)),
            )
        except LusciiPatientNotFoundError as exc:
            # Stale link: a linked Luscii patient vanished (or our token lost
            # access) after linking. Upstream problem, not caller error.
            raise LusciiUnavailableError(
                message="Linked Luscii patient is no longer accessible."
            ) from exc
        except LusciiApiError as exc:
            raise LusciiUnavailableError() from exc

        id_set = set(luscii_ids)
        relevant = [m for m in measurements if m.patient_id in id_set]
        decoder = await self._build_decoder(relevant)

        groups = [
            _connection_group(
                conn,
                details,
                planned_actions,
                [m for m in relevant if m.patient_id == str(conn.luscii_patient_id)],
                decoder,
            )
            for conn, details, planned_actions in zip(
                connections, details_list, actions_list, strict=True
            )
        ]

        # Legacy single-connection fields mirror the first connection until the
        # FE migrates to `connections[]` (see schema docstring).
        primary = groups[0]
        return LusciiPatientData(
            state="linked",
            luscii_patient_id=primary.luscii_patient_id,
            window_days=days,
            program=primary.program,
            protocol=primary.protocol,
            planned_actions=primary.planned_actions,
            unmatched_measurements=primary.measurements,
            series=primary.series,
            connections=groups,
        )

    async def _active_connections(self, patient_id: UUID) -> list[PatientLusciiConnection]:
        result = await self._session.scalars(
            select(PatientLusciiConnection)
            .where(
                PatientLusciiConnection.patient_id == patient_id,
                PatientLusciiConnection.status == LusciiConnectionStatus.ACTIVE,
                PatientLusciiConnection.deleted_at.is_(None),
            )
            .order_by(PatientLusciiConnection.created_at)
        )
        return list(result)

    async def _build_decoder(self, measurements: list[LusciiMeasurement]) -> _MeasurementDecoder:
        """Key-filtered lookups against the synced catalogue tables.

        Unsynced catalogue ⇒ empty lookups ⇒ decoder degrades to raw values
        (never an error) — run `moon run backend:luscii-sync` to populate.
        """
        instrument_keys = {
            (m.instrument_id, m.instrument_version)
            for m in measurements
            if m.instrument_id and m.instrument_version
        }
        item_keys: set[tuple[str, str]] = set()
        response_ids: set[str] = set()
        for m in measurements:
            for item in _parse_details(m.details):
                if item.item_id and item.item_version:
                    item_keys.add((item.item_id, item.item_version))
                response_ids.update(item.response_ids)

        instrument_rows: list[LusciiInstrumentLocalisationRow] = []
        if instrument_keys:
            instrument_rows = list(
                await self._session.scalars(
                    select(LusciiInstrumentLocalisationRow).where(
                        tuple_(
                            LusciiInstrumentLocalisationRow.instrument_id,
                            LusciiInstrumentLocalisationRow.instrument_version,
                        ).in_(list(instrument_keys))
                    )
                )
            )
        item_rows: list[LusciiInstrumentItemLocalisationRow] = []
        if item_keys:
            item_rows = list(
                await self._session.scalars(
                    select(LusciiInstrumentItemLocalisationRow).where(
                        tuple_(
                            LusciiInstrumentItemLocalisationRow.item_id,
                            LusciiInstrumentItemLocalisationRow.item_version,
                        ).in_(list(item_keys))
                    )
                )
            )
        response_rows: list[LusciiItemResponseLocalisationRow] = []
        if response_ids:
            response_rows = list(
                await self._session.scalars(
                    select(LusciiItemResponseLocalisationRow).where(
                        LusciiItemResponseLocalisationRow.item_response_id.in_(list(response_ids))
                    )
                )
            )
        return _MeasurementDecoder(instrument_rows, item_rows, response_rows)

    def _require_client(self) -> LusciiClient:
        if self._client is None:
            raise LusciiNotConfiguredError()
        return self._client


def _connection_group(
    conn: PatientLusciiConnection,
    details: LusciiPatientDetails,
    planned_actions: list[LusciiPlannedAction],
    own_measurements: list[LusciiMeasurement],
    decoder: _MeasurementDecoder,
) -> ConnectionGroup:
    """Build one connection's group: decode its measurements, join planned
    actions, project series. Pure given the decoder + live API objects."""
    decoded_pairs: list[tuple[LusciiMeasurement, LusciiMeasurementView]] = [
        (raw, decoder.decode(raw)) for raw in own_measurements
    ]
    by_planned_action: dict[str, LusciiMeasurementView] = {
        raw.planned_action_id: view for raw, view in decoded_pairs if raw.planned_action_id
    }
    matched_ids: set[str] = set()
    action_views: list[LusciiPlannedActionView] = []
    for action in planned_actions:
        measurement_view = by_planned_action.get(action.id)
        if measurement_view is not None:
            matched_ids.add(action.id)
        action_views.append(_action_view_from_decoded(action, measurement_view))
    unmatched = [
        view
        for raw, view in decoded_pairs
        if raw.planned_action_id is None or raw.planned_action_id not in matched_ids
    ]
    program = _program_view(details)
    series = project_series(
        [view for _raw, view in decoded_pairs],
        program_id=program.id if program else None,
    )
    return ConnectionGroup(
        connection_id=conn.id,
        luscii_patient_id=conn.luscii_patient_id,
        status=conn.status.value,
        program=program,
        protocol=_protocol_view(details),
        planned_actions=action_views,
        measurements=unmatched,
        series=series,
    )


def _program_view(details: LusciiPatientDetails) -> LusciiProgramView | None:
    if details.program is None:
        return None
    return LusciiProgramView(
        id=details.program.id,
        name=details.program.name,
        start_date=details.program.start_date.isoformat() if details.program.start_date else None,
    )


def _protocol_view(details: LusciiPatientDetails) -> LusciiProtocolView | None:
    if details.protocol is None:
        return None
    return LusciiProtocolView(id=details.protocol.id, name=details.protocol.name)


def _action_view_from_decoded(
    action: LusciiPlannedAction,
    measurement_view: LusciiMeasurementView | None,
) -> LusciiPlannedActionView:
    return LusciiPlannedActionView(
        id=action.id,
        not_before=action.not_before,
        expires_at=action.expires_at,
        completed_at=action.completed_at,
        created_at=action.created_at,
        self_planned=action.self_planned,
        measurement=measurement_view,
    )


def _pick_locale(by_locale: dict[str, _V]) -> _V | None:
    """`nl` (or any `nl-*`) wins; otherwise first locale, sorted for determinism."""
    for locale, value in by_locale.items():
        if locale == PREFERRED_LOCALE or locale.startswith(f"{PREFERRED_LOCALE}-"):
            return value
    for locale in sorted(by_locale):
        return by_locale[locale]
    return None


class _MeasurementDecoder:
    """Decodes `measurement.details` JSON into labelled display values.

    Built from locally synced catalogue rows (`catalogue_sync.py`) — any
    object with the right attribute names works. Per-item degradation: any
    lookup or parse miss yields the raw value with a null label — a decoding
    problem (or an unsynced catalogue) must never fail the request.
    """

    def __init__(
        self,
        instrument_locs: Iterable[Any],
        item_locs: Iterable[Any],
        response_locs: Iterable[Any],
    ) -> None:
        self._instruments: dict[tuple[str, str], dict[str, str | None]] = {}
        for loc in instrument_locs:
            self._instruments.setdefault((loc.instrument_id, loc.instrument_version), {})[
                loc.locale
            ] = loc.name
        self._items: dict[tuple[str, str], dict[str, tuple[str | None, str | None]]] = {}
        for item in item_locs:
            self._items.setdefault((item.item_id, item.item_version), {})[item.locale] = (
                item.title,
                item.unit,
            )
        self._responses: dict[str, dict[str, str | None]] = {}
        for resp in response_locs:
            self._responses.setdefault(resp.item_response_id, {})[resp.locale] = resp.response_text

    def decode(self, measurement: LusciiMeasurement) -> LusciiMeasurementView:
        return LusciiMeasurementView(
            measurement_id=measurement.measurement_id,
            instrument_id=measurement.instrument_id,
            instrument_name=self._instrument_name(measurement),
            created_at=measurement.created_at,
            processed_at=measurement.processed_at,
            values=self._decode_details(measurement.details, measurement.instrument_id),
        )

    def _instrument_name(self, measurement: LusciiMeasurement) -> str | None:
        if measurement.instrument_id is None or measurement.instrument_version is None:
            return None
        return _pick_locale(
            self._instruments.get((measurement.instrument_id, measurement.instrument_version), {})
        )

    def _decode_details(
        self, details: str, instrument_id: str | None
    ) -> list[LusciiMeasurementValueView]:
        return [self._decode_item(item, instrument_id) for item in _parse_details(details)]

    def _decode_item(
        self,
        item: LusciiMeasurementDetailItem,
        instrument_id: str | None,
    ) -> LusciiMeasurementValueView:
        loc: tuple[str | None, str | None] | None = None
        if item.item_id is not None and item.item_version is not None:
            loc = _pick_locale(self._items.get((item.item_id, item.item_version), {}))
        texts: list[str] = []
        for response_id in item.response_ids:
            text = _pick_locale(self._responses.get(response_id, {}))
            if text:
                texts.append(text)
        title, unit = loc if loc is not None else (None, None)
        archetype = classify_archetype(item.value, item.response_ids, unit)
        return LusciiMeasurementValueView(
            label=title,
            value=item.value,
            unit=unit,
            response_texts=texts,
            item_id=item.item_id,
            instrument_id=instrument_id,
            archetype=archetype,
        )


def _parse_details(details: str) -> list[LusciiMeasurementDetailItem]:
    try:
        raw_items = json.loads(details) if details else []
    except ValueError:
        logger.warning("luscii.measurement.details_unparseable")
        return []
    if not isinstance(raw_items, list):
        return []
    parsed: list[LusciiMeasurementDetailItem] = []
    for raw in raw_items:
        try:
            parsed.append(LusciiMeasurementDetailItem.model_validate(raw))
        except ValidationError:
            parsed.append(LusciiMeasurementDetailItem(value=str(raw)))
    return parsed
