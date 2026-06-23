## Why

When an admin creates a user, the system today auto-generates a random placeholder password (`secrets.token_urlsafe(32)`), hashes it, and imports it into Kratos. The placeholder is immediately discarded, so the new user has no usable credential — onboarding their real password is deferred to a separate auth-hardening track that does not yet exist. In practice this means a freshly created user cannot log in at all.

For the PoC/demo we want the admin to set the credential directly: on the create form, the admin types the password the new user will use. This makes "create a user" produce a login-ready account in one step, with no second flow.

## What Changes

- **`UserCreate` gains a required `password` field** (min 8 chars), validated server-side. It is accepted on `POST /users` for both the clinician and non-clinician branches.
- **`UserService.create` uses the typed password as the credential** — it hashes the supplied password (Argon2id, the existing `PasswordHasher`) and imports that hash into Kratos as the login credential, instead of generating and discarding a random placeholder. The `password_hash` projection column stores the same real hash.
- **The orchestrator create form gains a password input** — shown in **create mode only** (edit mode never touches credentials). Required, min 8 chars, `type="password"`, `autoComplete="new-password"`. Included in the create payload; never echoed back.
- **Frontend client + types** — `UserCreatePayload` picks up `password` from the regenerated OpenAPI schema; the create form's Zod schema validates it.

## Capabilities

### Modified Capabilities
- `users-admin-ui`: `UserCreate` carries a required `password` (min 8); `UserService.create` provisions the Kratos credential from the typed password rather than a discarded placeholder; the create form renders a password field (create mode only) and sends it in the create payload.

## Impact

- **Backend**: `app/schemas/user/user.py` (`UserCreate.password`, min-length validation); `app/services/user/user_service.py` (`create` hashes + imports the typed password, placeholder generation removed). `UserRow` response is unchanged — the password is never returned.
- **Frontend (orchestrator)**: `modules/user/components/userForm.schema.ts` (password field + create-mode validation); `UserFormPage.tsx` (password input in create mode, included in `buildCreatePayload`); `nl/users-admin-ui.json` (password label/hint + length error); regenerated `schema.d.ts`.
- **Migrations**: none — `users.password_hash` already exists; no schema change.
- **Out of scope**: changing a password after create (no edit-mode credential field, no reset flow); password-strength rules beyond a length floor; the one-human-multiple-roles case where a Kratos identity already exists for the email keeps its existing credential (the typed password is not re-applied — see design D3); removing the legacy `password_hash` column (a later cleanup change owns that).
