"""Live Luscii public-API client (luscii-patient-enrichment).

httpx-based, bearer-token auth, cursor pagination handled internally.
Errors never include the token or raw upstream bodies — only method, path,
and status reach exception messages and logs.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, SecretStr, ValidationError

from app.adapters.luscii.api_models import (
    LusciiInstrumentItemLocalisation,
    LusciiInstrumentLocalisation,
    LusciiItemResponseLocalisation,
    LusciiMeasurement,
    LusciiPatientDetails,
    LusciiPlannedAction,
)
from app.adapters.luscii.errors import LusciiApiError, LusciiPatientNotFoundError

_TIMEOUT_SECONDS = 10.0
_PER_PAGE = 100
# Runaway guard for cursor loops: raise rather than silently truncate.
_MAX_PAGES_PER_CALL = 50
# The localisation catalogues are legitimately huge (measured 2026-06-10:
# 15.6k instrument-, 40k+ item-, 200k+ response-localisations) and only
# fetched by the offline sync script — they get a much larger page budget
# than request-path calls. Still finite: the guard catches runaway cursors,
# not honest catalogue size.
_MAX_CATALOGUE_PAGES = 10_000

_M = TypeVar("_M", bound=BaseModel)

logger = logging.getLogger(__name__)

# Cursor pagination exposes no totals, so long fetches report progress as
# periodic log lines instead of a bar.
_PROGRESS_EVERY_PAGES = 25


class LusciiHttpClient:
    """Implements the `LusciiClient` Protocol against the live public API."""

    def __init__(
        self,
        base_url: str,
        token: SecretStr,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {token.get_secret_value()}"},
            timeout=_TIMEOUT_SECONDS,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def ping(self) -> None:
        await self._request("GET", "/v1/diagnostics/ping")

    async def get_patient(self, luscii_patient_id: str) -> LusciiPatientDetails:
        response = await self._request(
            "GET",
            f"/v1/patients/{luscii_patient_id}",
            expect_404=True,
        )
        if response.status_code in (403, 404):
            raise LusciiPatientNotFoundError(
                luscii_patient_id, status_code=response.status_code
            )
        return self._parse(LusciiPatientDetails, self._data_of(response))

    async def get_planned_actions(
        self, luscii_patient_id: str, start_date: date, end_date: date
    ) -> list[LusciiPlannedAction]:
        return await self._paginate(
            f"/v1/patients/{luscii_patient_id}/planned-actions",
            LusciiPlannedAction,
            params={
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
            },
        )

    async def get_measurements(
        self, start_date: date, end_date: date
    ) -> list[LusciiMeasurement]:
        return await self._paginate(
            "/v1/measurements",
            LusciiMeasurement,
            params={
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
            },
        )

    async def get_instrument_localisations(self) -> list[LusciiInstrumentLocalisation]:
        return await self._paginate(
            "/v1/instrument-localisations",
            LusciiInstrumentLocalisation,
            max_pages=_MAX_CATALOGUE_PAGES,
            progress_label="instrument-localisations",
        )

    async def get_instrument_item_localisations(
        self,
    ) -> list[LusciiInstrumentItemLocalisation]:
        return await self._paginate(
            "/v1/instrument-item-localisations",
            LusciiInstrumentItemLocalisation,
            max_pages=_MAX_CATALOGUE_PAGES,
            progress_label="instrument-item-localisations",
        )

    async def get_item_response_localisations(
        self,
    ) -> list[LusciiItemResponseLocalisation]:
        return await self._paginate(
            "/v1/instrument-item-response-localisations",
            LusciiItemResponseLocalisation,
            max_pages=_MAX_CATALOGUE_PAGES,
            progress_label="item-response-localisations",
        )

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        expect_404: bool = False,
    ) -> httpx.Response:
        try:
            response = await self._http.request(method, path, params=params)
        except httpx.HTTPError as exc:
            # httpx exception reprs don't carry request headers; safe to chain.
            raise LusciiApiError(f"Luscii {method} {path} transport failure") from exc
        if response.status_code >= 400 and not (
            expect_404 and response.status_code in (403, 404)
        ):
            raise LusciiApiError(
                f"Luscii {method} {path} returned {response.status_code}",
                status_code=response.status_code,
            )
        return response

    async def _paginate(
        self,
        path: str,
        model: type[_M],
        *,
        params: dict[str, Any] | None = None,
        max_pages: int = _MAX_PAGES_PER_CALL,
        progress_label: str | None = None,
    ) -> list[_M]:
        rows: list[_M] = []
        cursor: str | None = None
        for page in range(1, max_pages + 1):
            page_params: dict[str, Any] = {**(params or {}), "perPage": _PER_PAGE}
            if cursor is not None:
                page_params["cursor"] = cursor
            response = await self._request("GET", path, params=page_params)
            body = self._json_of(response)
            rows.extend(self._parse(model, item) for item in body.get("data", []))
            cursor = (body.get("meta") or {}).get("nextCursor")
            if progress_label and (cursor is None or page % _PROGRESS_EVERY_PAGES == 0):
                logger.info(
                    "luscii sync %s: %d rows in %d pages%s",
                    progress_label,
                    len(rows),
                    page,
                    "" if cursor else " — done",
                )
            if cursor is None:
                return rows
        raise LusciiApiError(
            f"Luscii GET {path} exceeded {max_pages} pages; refusing to truncate"
        )

    def _data_of(self, response: httpx.Response) -> Any:
        return self._json_of(response).get("data")

    def _json_of(self, response: httpx.Response) -> dict[str, Any]:
        try:
            body = response.json()
        except ValueError as exc:
            raise LusciiApiError(
                f"Luscii GET {response.request.url.path} returned non-JSON body"
            ) from exc
        if not isinstance(body, dict):
            raise LusciiApiError(
                f"Luscii GET {response.request.url.path} returned unexpected JSON shape"
            )
        return body

    def _parse(self, model: type[_M], payload: Any) -> _M:
        try:
            return model.model_validate(payload)
        except ValidationError as exc:
            # ValidationError messages contain field names only, not the body.
            raise LusciiApiError(f"Luscii payload failed {model.__name__} validation") from exc
