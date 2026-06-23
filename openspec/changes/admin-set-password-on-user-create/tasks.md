## 1. Backend schema

- [x] 1.1 Add `password: str` to `UserCreate` (`app/schemas/user/user.py`) with `Field(min_length=8)`; keep `extra="forbid"`. Field applies to both branches (outside the clinician/non-clinician discrimination). Add/adjust the docstring to note credentials are now supplied, not auto-generated.

## 2. Backend service

- [x] 2.1 In `UserService.create` (`app/services/user/user_service.py`) remove the `secrets.token_urlsafe(32)` placeholder; hash `payload.password` with `self._password_hasher` and use that hash for both the Kratos `import_identity` call and the `User.password_hash` column.
- [x] 2.2 Preserve the existing-identity short-circuit (D3): when `find_identity_by_email` returns a row, do NOT re-import; the new `User` row still stores the freshly hashed `password_hash`. Add a short comment recording "first credential wins".
- [x] 2.3 Confirm no plaintext password is logged anywhere on this path; `secrets` import removed if now unused.

## 3. Backend tests

- [x] 3.1 Create with a typed password (non-clinician + clinician branches) → `201`; the created user can authenticate via the login flow with that password.
- [x] 3.2 Password shorter than 8 chars → `422`; no user/identity created.
- [x] 3.3 `UserRow` response body does NOT contain the password.

## 4. OpenAPI sync

- [x] 4.1 Run `/openapi-sync` (regenerate `apps/backend/openapi.json` then `orchestrator:typegen`) so `UserCreate.password` lands in `schema.d.ts` / `UserCreatePayload`.

## 5. Frontend form

- [x] 5.1 In `userForm.schema.ts`, factor the base object shape + refine, export `userFormSchema` (edit, no password) and `createUserFormSchema` (adds `password: z.string().min(8, { message: 'form.error.password_too_short' })`). Export `CreateUserFormValues`.
- [x] 5.2 In `UserFormPage.tsx`: `CreateUserForm` uses `createUserFormSchema` + create defaults including `password: ''`; render a password `Input` (`type="password"`, `autoComplete="new-password"`) in the Identiteit card, create mode only; include `password` in `buildCreatePayload`. `EditUserForm` keeps `userFormSchema` (no password rendered/validated).
- [x] 5.3 Add i18n keys to `nl/users-admin-ui.json`: `form.field.password.{label,placeholder,hint}` and `form.error.password_too_short`.

## 6. Frontend tests

- [x] 6.1 Create form: password field present in create mode, absent in edit mode; min-8 validation surfaces the resolved Dutch error; submit includes `password` in the payload.

## 7. Verify

- [x] 7.1 Run `/verify` (lint + typecheck + tests, backend + orchestrator); quote results.
- [ ] 7.2 Browser check: create a user with a typed password as admin, then log in as that user with the password; confirm success. Confirm edit mode shows no password field.
