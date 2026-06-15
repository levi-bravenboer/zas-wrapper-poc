"""Adapter dependency factories.

`build_*` helpers are plain functions used at app boot to wire readiness
pings. `get_*` wrappers expose the same construction via FastAPI's
dependency-injection so handlers can ask for `HixClientDep`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.adapters.hix import HixClient, HixStubClient
from app.adapters.luscii import LusciiClient, LusciiHttpClient
from app.adapters.luscii.fixture import LusciiFixtureClient
from app.core.settings import Settings, SettingsDep


def build_hix_client(settings: Settings) -> HixClient:
    if settings.hix_mode == "stub":
        return HixStubClient()
    raise NotImplementedError("Live HiX client not implemented in PoC scope.")


def build_luscii_client(settings: Settings) -> LusciiClient | None:
    """Token-presence-driven: token set ⇒ live client, unset ⇒ unconfigured.

    Local-dev override: when no token is set AND `luscii_fixtures` is true,
    return the in-process `LusciiFixtureClient` so the chart UI demos with
    canned data. Fixture mode never engages when a real token is present.
    """
    if settings.luscii_api_token is not None:
        return LusciiHttpClient(str(settings.luscii_api_url), settings.luscii_api_token)
    if settings.luscii_fixtures:
        return LusciiFixtureClient()
    return None


def get_hix_client(settings: SettingsDep) -> HixClient:
    return build_hix_client(settings)


def get_luscii_client(request: Request) -> LusciiClient | None:
    # App-lifetime client built once at boot (owns a pooled httpx client);
    # rebuilding per request would leak connection pools.
    return request.app.state.luscii_client


HixClientDep = Annotated[HixClient, Depends(get_hix_client)]
LusciiClientDep = Annotated[LusciiClient | None, Depends(get_luscii_client)]
