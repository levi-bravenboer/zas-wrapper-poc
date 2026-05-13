"""Cookie helpers for `TestClient`.

Most tests already get a cookie-aware client because `TestClient` shares
the underlying `httpx.Client` cookie jar across calls. These helpers
exist for the cases where a test needs to forge or inspect specific
cookies (e.g. tampered cookies, expired sessions).
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def set_cookie(client: TestClient, name: str, value: str) -> None:
    client.cookies.set(name, value)


def clear_cookies(client: TestClient) -> None:
    client.cookies.clear()


def get_cookie(client: TestClient, name: str) -> str | None:
    return client.cookies.get(name)
