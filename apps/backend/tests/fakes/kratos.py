"""In-memory stand-in for Ory Kratos used by the test suite.

Mirrors the slice of Kratos behaviour the backend depends on: password
login flows verified against argon2id hashes, opaque session tokens
resolved via whoami, server-side revocation, identity import, and
identity state (active / inactive).

`login_with_password` is DB-backed: it reads the `users` row for the
email, verifies the supplied password against `password_hash`, and —
exactly like `scripts/import_identities_kratos.py` would — auto-links a
Kratos identity (`external_idp` / `external_subject`) on first login so
existing tests that seed rows manually keep working unchanged.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models.user import User
from app.services.access.identity.kratos_client import (
    KratosClient,
    KratosIdentity,
    KratosLoginSuccess,
    KratosSchemaId,
    KratosSession,
)
from app.services.access.identity.password import PasswordHasher

KRATOS_IDP = "kratos"


@dataclass
class FakeKratosClient(KratosClient):
    session_factory: async_sessionmaker[AsyncSession]
    hasher: PasswordHasher = field(default_factory=PasswordHasher)
    # identity_id → registered identity (import_identity / auto-link)
    identities: dict[str, KratosIdentity] = field(default_factory=dict)
    # identity_id → hashed password (for identities imported pre-DB-row)
    hashes: dict[str, str] = field(default_factory=dict)
    inactive: set[str] = field(default_factory=set)
    # session token → (identity_id, session_id)
    sessions: dict[str, tuple[str, str]] = field(default_factory=dict)

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        # Deliberately does NOT call KratosClient.__init__ — no HTTP here.
        self.session_factory = session_factory
        self.hasher = PasswordHasher()
        self.identities = {}
        self.hashes = {}
        self.inactive = set()
        self.sessions = {}

    # ── public API ──────────────────────────────────────────────────────

    async def login_with_password(self, *, email: str, password: str) -> KratosLoginSuccess | None:
        async with self.session_factory() as session:
            result = await session.execute(
                select(User).where(User.email == email, User.deleted_at.is_(None))
            )
            rows = list(result.scalars().all())
            if not rows:
                return None
            # One human = one identity: verify against any row carrying a
            # hash, then link EVERY row of the email to the same identity —
            # exactly what the grouped import script produces (REQ-NON-3).
            user = next((u for u in rows if u.password_hash is not None), None)
            if user is None:
                return None
            if not self.hasher.verify(user.password_hash, password):
                return None
            identity_id = next(
                (u.external_subject for u in rows if u.external_subject is not None), None
            )
            if identity_id is None:
                identity_id = str(uuid.uuid4())
            changed = False
            for row in rows:
                if row.external_subject != identity_id:
                    row.external_idp = KRATOS_IDP
                    row.external_subject = identity_id
                    changed = True
            if changed:
                await session.commit()
            if identity_id in self.inactive:
                return None
            token = f"fake-kratos-{uuid.uuid4()}"
            session_id = f"fake-session-{uuid.uuid4()}"
            self.sessions[token] = (identity_id, session_id)
            return KratosLoginSuccess(
                identity_id=identity_id, session_token=token, session_id=session_id
            )

    async def whoami(self, *, session_token: str) -> KratosSession | None:
        entry = self.sessions.get(session_token)
        if entry is None:
            return None
        return KratosSession(identity_id=entry[0], session_id=entry[1])

    async def logout(self, *, session_token: str) -> None:
        self.sessions.pop(session_token, None)

    # ── admin API ───────────────────────────────────────────────────────

    async def import_identity(
        self,
        *,
        schema_id: KratosSchemaId,
        email: str,
        hashed_password: str,
    ) -> KratosIdentity:
        identity = KratosIdentity(
            id=str(uuid.uuid4()), schema_id=schema_id, state="active", email=email
        )
        self.identities[identity.id] = identity
        self.hashes[identity.id] = hashed_password
        return identity

    async def find_identity_by_email(self, *, email: str) -> KratosIdentity | None:
        for identity in self.identities.values():
            if identity.email == email:
                return identity
        return None

    async def revoke_identity_sessions(self, *, identity_id: str) -> None:
        self.sessions = {
            token: entry for token, entry in self.sessions.items() if entry[0] != identity_id
        }

    async def set_identity_state(self, *, identity_id: str, active: bool) -> None:
        if active:
            self.inactive.discard(identity_id)
        else:
            self.inactive.add(identity_id)
