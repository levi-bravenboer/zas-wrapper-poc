"""Thin async client for the Ory Kratos public + admin APIs.

The backend never verifies credentials or signs session material itself —
Kratos owns both. This client wraps exactly the calls the identity layer
needs: native login flows (public), whoami (public), and identity
import / lifecycle / session revocation (admin).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.core.settings import Settings

KratosSchemaId = Literal["default", "practitioner", "patient"]


class KratosError(RuntimeError):
    """Kratos answered with an unexpected status — infrastructure, not user error."""


@dataclass(frozen=True)
class KratosLoginSuccess:
    identity_id: str
    session_token: str
    session_id: str


@dataclass(frozen=True)
class KratosSession:
    """whoami projection: the identity AND the concrete session — the
    session id keys `session_role_bindings` (multi-role, REQ-NON-3)."""

    identity_id: str
    session_id: str


@dataclass(frozen=True)
class KratosIdentity:
    id: str
    schema_id: str
    state: str
    email: str | None


def _identity_from_payload(payload: dict[str, Any]) -> KratosIdentity:
    return KratosIdentity(
        id=payload["id"],
        schema_id=payload.get("schema_id", ""),
        state=payload.get("state", ""),
        email=(payload.get("traits") or {}).get("email"),
    )


class KratosClient:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self._public = str(settings.kratos_public_url).rstrip("/")
        self._admin = str(settings.kratos_admin_url).rstrip("/")
        self._http = http

    # ── public API ──────────────────────────────────────────────────────

    async def login_with_password(self, *, email: str, password: str) -> KratosLoginSuccess | None:
        """Run a native (API-flavoured) login flow. `None` means Kratos
        rejected the credentials; any transport / 5xx problem raises."""

        flow = await self._http.get(f"{self._public}/self-service/login/api")
        if flow.status_code != 200:
            raise KratosError(f"login flow init returned {flow.status_code}")
        flow_id = flow.json()["id"]

        submit = await self._http.post(
            f"{self._public}/self-service/login",
            params={"flow": flow_id},
            json={"method": "password", "identifier": email, "password": password},
        )
        if submit.status_code == 200:
            body = submit.json()
            return KratosLoginSuccess(
                identity_id=body["session"]["identity"]["id"],
                session_token=body["session_token"],
                session_id=body["session"]["id"],
            )
        if submit.status_code in (400, 401, 403):
            return None
        raise KratosError(f"login submit returned {submit.status_code}")

    async def whoami(self, *, session_token: str) -> KratosSession | None:
        """Resolve a session token to its identity + session ids. `None` for
        missing, expired, or revoked sessions."""

        response = await self._http.get(
            f"{self._public}/sessions/whoami",
            headers={"X-Session-Token": session_token},
        )
        if response.status_code == 200:
            body = response.json()
            return KratosSession(identity_id=body["identity"]["id"], session_id=body["id"])
        if response.status_code in (401, 403):
            return None
        raise KratosError(f"whoami returned {response.status_code}")

    async def logout(self, *, session_token: str) -> None:
        """Revoke the session belonging to `session_token` (server-side)."""

        response = await self._http.request(
            "DELETE",
            f"{self._public}/self-service/logout/api",
            json={"session_token": session_token},
        )
        # 204 on success; 401/403 mean the session is already dead — fine.
        if response.status_code not in (204, 401, 403, 404):
            raise KratosError(f"logout returned {response.status_code}")

    # ── admin API ───────────────────────────────────────────────────────

    async def import_identity(
        self,
        *,
        schema_id: KratosSchemaId,
        email: str,
        hashed_password: str,
    ) -> KratosIdentity:
        """Create an identity carrying an existing argon2id hash verbatim."""

        response = await self._http.post(
            f"{self._admin}/admin/identities",
            json={
                "schema_id": schema_id,
                "traits": {"email": email},
                "credentials": {"password": {"config": {"hashed_password": hashed_password}}},
            },
        )
        if response.status_code != 201:
            raise KratosError(f"identity import returned {response.status_code}: {response.text}")
        return _identity_from_payload(response.json())

    async def find_identity_by_email(self, *, email: str) -> KratosIdentity | None:
        response = await self._http.get(
            f"{self._admin}/admin/identities",
            params={"credentials_identifier": email},
        )
        if response.status_code != 200:
            raise KratosError(f"identity lookup returned {response.status_code}")
        matches = response.json()
        if not matches:
            return None
        return _identity_from_payload(matches[0])

    async def revoke_identity_sessions(self, *, identity_id: str) -> None:
        """Kill every session for an identity — next whoami answers 401."""

        response = await self._http.delete(f"{self._admin}/admin/identities/{identity_id}/sessions")
        if response.status_code not in (204, 404):
            raise KratosError(f"session revocation returned {response.status_code}")

    async def set_identity_state(self, *, identity_id: str, active: bool) -> None:
        """Disable (or re-enable) an identity so it cannot start login flows."""

        response = await self._http.patch(
            f"{self._admin}/admin/identities/{identity_id}",
            json=[
                {
                    "op": "replace",
                    "path": "/state",
                    "value": "active" if active else "inactive",
                }
            ],
        )
        if response.status_code != 200:
            raise KratosError(f"identity state patch returned {response.status_code}")
