"""Temporal client factory for the pathway runtime.

The API process uses this to start enrollment workflows and send Updates;
the worker process (`app.temporal.worker`) uses it to connect and poll.
"""

from __future__ import annotations

from temporalio.client import Client

from app.core.settings import get_settings


async def get_temporal_client() -> Client:
    settings = get_settings()
    return await Client.connect(
        settings.temporal_address,
        namespace=settings.temporal_namespace,
    )
