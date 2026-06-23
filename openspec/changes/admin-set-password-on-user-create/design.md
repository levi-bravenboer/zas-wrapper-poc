## Context

The credential path already exists end to end — only the *source* of the password changes.

- **Backend** — `POST /users` (`user_router.py:60`) → `UserService.create` (`user_service.py:91`). Today the service generates `placeholder_password = secrets.token_urlsafe(32)` (`user_service.py:115`), hashes it with `PasswordHasher` (Argon2id, `services/access/identity/password.py`), and imports the hash into Kratos via `KratosClient.import_identity(schema_id, email, hashed_password=...)` (`kratos_client.py:120`) — "create an identity carrying an existing argon2id hash verbatim." The random secret is then discarded. `UserCreate` (`schemas/user/user.py:44`) has no password field and uses `extra="forbid"`.
- **Frontend** — one `<UserFormPage>` is shared by create and edit (`UserFormPage.tsx:85`). Validation is a single Zod schema (`userForm.schema.ts`) used by both modes; `buildCreatePayload` (`UserFormPage.tsx:52`) builds the `UserCreate` body. Field copy is i18n keys under `nl/users-admin-ui.json`.

The insight: Kratos import already takes an Argon2id hash verbatim. Supplying the *real* password's hash instead of a placeholder makes it the working login credential with no new Kratos plumbing.

## Goals / Non-Goals

**Goals:**
- Admin types the new user's password on create; the created account can log in with it immediately.
- One required password field, min 8 chars, validated on both sides.
- No credential surface in edit mode; no new reset/change flow.

**Non-Goals:**
- Password change/reset after create; complexity rules beyond a length floor.
- Returning or displaying the password anywhere after submit.
- Removing the legacy `password_hash` column.

## Decisions

- **D1 — `password` is required, min 8 chars.** Added to `UserCreate` as `password: str` with `Field(min_length=8)`; Pydantic rejects `<8` with `422`. Reason: user decision — every created user must get a login-ready credential, with a simple length floor (no complexity matrix). Applies to both the clinician and non-clinician branches (it sits outside the existing branch discrimination).
- **D2 — The typed password becomes the Kratos credential; the placeholder is removed.** `UserService.create` hashes `payload.password` with the existing `PasswordHasher` and passes that hash to `import_identity` exactly where the placeholder hash went. `secrets.token_urlsafe(...)` generation is deleted. The `User.password_hash` projection column stores the same real hash (the `ck_users_credential_present` CHECK is still satisfied). Reason: minimal change that reuses the established import seam.
- **D3 — Existing Kratos identity (one human, multiple roles) keeps its credential.** `create` already short-circuits the import when `find_identity_by_email` returns a row (REQ-NON-3: one human = one Kratos identity; a second role row links to the existing identity). In that case the typed password is NOT applied to Kratos — the existing identity's credential is authoritative. The new `User` row still stores the freshly hashed `password_hash` for projection consistency, but login continues to use the existing Kratos credential. Reason: re-importing would either duplicate or silently overwrite an existing person's password; for the PoC the safe behaviour is "first credential wins." This is documented, not silently dropped.
- **D4 — The password never leaves the backend after import.** `UserRow` (the create response) is unchanged — no password echo. The plaintext is used only to compute the hash and is not logged. Reason: avoid leaking a credential through responses or logs.
- **D5 — Frontend: password in create mode only, via a create-specific schema.** The shared form keeps a base schema (edit) and a `createUserFormSchema` that adds `password: z.string().min(8)`. `CreateUserForm` uses the create schema; `EditUserForm` uses the base schema, so edit neither renders nor validates a password. The input is `type="password"`, `autoComplete="new-password"`, rendered in the Identiteit card. `buildCreatePayload` includes `password`. Reason: keeps edit mode untouched while making the field required on create; avoids a hidden always-empty field failing edit validation.
- **D6 — Backend is the source of truth for the length rule; the FE mirrors it for UX.** Both enforce min 8; the FE check gives inline feedback, the backend `422` is the real gate. Reason: never trust the client; keep the two in sync at the same floor.

## Risks / Trade-offs

- **Plaintext password crosses the wire.** Accepted: this is standard for an admin-set-password flow, transport is HTTPS, and the value is hashed immediately server-side and never persisted in plaintext or logged. No worse than any login form.
- **D3 surprise.** An admin re-using an existing person's email (to add a second role) types a password that has no effect on login. Mitigation: documented here and in the proposal's out-of-scope; the create still succeeds and the existing credential keeps working. A future change could surface "this person already has a login" in the UI.
- **OpenAPI drift.** Adding `password` to `UserCreate` changes the `create_user` request schema → `/openapi-sync` must run so `UserCreatePayload` carries `password`, or the FE payload type is wrong.

## Migration Plan

No DB migration. `users.password_hash` already exists and is already populated on create (today with a placeholder hash, after this change with the real one). The change is a request-schema + service-logic change requiring `/openapi-sync`, not Alembic.

## Open Questions

- None. Required + min-8 confirmed by the user; D3 (existing-identity) resolved as "first credential wins" for the PoC.
