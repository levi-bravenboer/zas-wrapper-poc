"""Adapter dependency factories.

`build_*` helpers are plain functions used at app boot to wire readiness
pings. `get_*` wrappers expose the same construction via FastAPI's
dependency-injection so handlers can ask for `HixClientDep`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.adapters.hix import HixClient, HixStubClient
from app.adapters.luscii import LusciiClient, LusciiStubClient
from app.core.settings import Settings, SettingsDep


def build_hix_client(settings: Settings) -> HixClient:
    if settings.hix_mode == "stub":
        return HixStubClient()
    raise NotImplementedError("Live HiX client not implemented in PoC scope.")


def build_luscii_client(settings: Settings) -> LusciiClient:
    if settings.luscii_mode == "stub":
        return LusciiStubClient()
    raise NotImplementedError("Live Luscii client not implemented in PoC scope.")


def get_hix_client(settings: SettingsDep) -> HixClient:
    return build_hix_client(settings)


def get_luscii_client(settings: SettingsDep) -> LusciiClient:
    return build_luscii_client(settings)


HixClientDep = Annotated[HixClient, Depends(get_hix_client)]
LusciiClientDep = Annotated[LusciiClient, Depends(get_luscii_client)]
