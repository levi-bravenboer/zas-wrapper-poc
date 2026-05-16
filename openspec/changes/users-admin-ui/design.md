## Context

Admin UI for tenant users. Chain slot #3, post-#2.5 (`entity-page-scaffolding`). Backend `user-base` ships only `GET /users` + `PATCH /users/{id}/role`. Frontend has placeholder admin route group and (since #2.5) shared `<EntityDetailPage>` / `<EntityFormPage>` chrome + `useEntityForm` / `useDirtyGuard` / `useEntityDelete` hooks. `practitioner-role-split` (#1) shipped the Practitioner + PractitionerRole tables; caregiver users get an auto-materialised Practitioner row on creation.

This is the first downstream consumer of #2.5 — its concrete shape locks how subsequent admin UIs (`#4`, `#5`, `#7`) will look.

## Goals / Non-Goals

**Goals:**
- Admin can list, search, filter, create, edit, deactivate users end-to-end.
- Caregiver creation atomically materialises a Practitioner row (one transaction).
- Detail page surfaces user demographics + linked Practitioner + open / closed PractitionerRole rows.
- Reuse `#2.5` entity-page chrome and hooks verbatim — no parallel chrome.
- Establish the pattern (route layout, file layout, naming) that `#4 organisations-admin-ui` and `#5 practitioner-roles-admin-ui` will follow.

**Non-Goals:**
- Affiliation editing (creating / updating PractitionerRole rows) — deferred to `#5`.
- Password / IdP / SSO flows — out of chain.
- Bulk import / CSV / activity audit log — backlog.
- Inline editing in the list — full-page edit only.

## Decisions

### D1 — Full-page create + edit (not dialogs)

Routes `/_auth/admin/users/new` + `/_auth/admin/users/$userId/edit` both render a single `<UserFormPage mode>` component built on `<EntityFormPage>`. Single component, `mode: 'create' | 'edit'` discriminator. Form schema differs by mode (email + role only on create; is_active only on edit).

**Why:** Locked in `#2.5` brainstorming. Dialogs lose dirty-guard + back-button semantics; full pages let `useDirtyGuard` block in-app nav cleanly and give a single place for permission gating later. One component avoids drift between create + edit field tree.

**Alternatives considered:** Two separate components (`CreateUserPage`, `EditUserPage`) — rejected: 80% field overlap, duplicated Zod schemas. Dialogs — rejected per `#2.5` decision.

### D2 — Detail layout: SingleColumn with two Cards

`<EntityDetailPage>` wrapping `<EntityDetailSingleColumn>` containing Demographics card + (conditionally) Practitioner card. No tabs in v1.

**Why:** Two sections only, and the Practitioner section is conditional (admins hide it). Tabs add navigation overhead for an info-dense detail. If `#7 care-teams-ui` later needs an embedded team panel, it's an additive third card.

**Alternatives considered:** Tabs (`Overzicht | Praktijk`) — rejected: noisier for two sections, one of which is hidden half the time. Two-column grid — rejected: doesn't reflow well on the narrow admin sidebar layout.

### D3 — Deactivate via `useEntityDelete`-adapted soft-delete

The `Deactiveren` action is a soft-delete: AlertDialog confirm → `PATCH /users/{id} { is_active: false }` → toast + invalidate. Reuses `useEntityDelete`'s dialog + state but swaps the mutation body.

**Why:** Hard delete would orphan PractitionerRole + CareTeamParticipant rows. `useEntityDelete` already owns the AlertDialog + toast + invalidation flow; consumers parameterise the mutation. No new hook needed.

**Self-protection:** Both the kebab on the list row and the header action on the detail page disable when `target.id === currentSession.user.id`. Backend additionally rejects with `409 conflict.user.self_deactivate` as defense-in-depth.

### D4 — Atomic caregiver creation in a single transaction

`POST /users` with `role=caregiver` opens one DB transaction, inserts the User row, then calls `PractitionerService.create` in the same transaction. Practitioner failure (e.g. forced unique violation) rolls back the User insert.

**Why:** Half-materialised state (User without Practitioner) makes visibility predicates flaky — caregivers without Practitioner rows are invisible to `/patients` queries. Test (`test_user_service_create_atomic.py`) asserts no orphan User after a forced Practitioner failure.

**Alternatives considered:** Two-step API (`POST /users` then `POST /practitioners`) — rejected: client retries on partial failure are hard to reason about; the atomic path is simpler to spec + test.

### D5 — Email uniqueness conflict surfaces as `409 conflict.user.email_exists`

Server returns structured `ErrorResponse{ code, field? }`. Frontend maps the `code` to an inline field error on the `email` input. Route stays mounted; form state preserved.

**Why:** Generic 500 / unstructured 400 makes UX brittle. Existing `errors-logging` capability mandates structured error codes; reuse the pattern.

### D6 — Zod schema source of truth, TanStack Form via `useEntityForm`

`UserFormSchema` (Zod) lives in `apps/orchestrator/src/features/users/userForm.schema.ts`. Per-mode schemas are derived via `.omit()` / `.partial()`. `useEntityForm` adapts the Zod schema as the form's standard-schema validator (already proven in `#2.5`).

**Why:** `#2.5` locks the pattern. No new validator library.

### D7 — Filter envelope shape

List filters use the existing `ListQuery` envelope (`filter[field][op]=value` + `q=...` + `sort=...&order=...`). `Rol` filter is `filter[role][eq]=caregiver` (single value). `Actief` toggle is `filter[is_active][eq]=true|false`. Backend widens `GET /users` to accept `role` + `q` (over `display_name + email`) on top of the existing `is_active` filter. No new filter primitives.

**Why:** `caregiver-shell` shipped `<FilterableListPage>` + the query envelope; reuse verbatim. Adding filter primitives belongs in `caregiver-shell`, not here.

## Risks / Trade-offs

- **R1 — Practitioner auto-materialisation derives `family_name` / `given_name` from `display_name` heuristically (last-token = family_name, rest = given_name).** First-character ambiguity (single-word names, hyphenated names). **Mitigation:** the form's `qualification` field gets surfaced; later (`#5`) the admin can edit Practitioner demographics directly. For demo data the heuristic is acceptable.

- **R2 — `is_active=false` is reversible but the deactivate flow looks like a delete (AlertDialog + danger variant).** Copy must clearly say "Deactiveren" not "Verwijderen"; the AlertDialog message says the user can be reactivated later.

- **R3 — Race between detail-page mount and `/practitioners/{userId}` 404.** A caregiver who lost their Practitioner row (shouldn't happen post-#1 but defensively) — the Practitioner card MUST NOT crash. **Mitigation:** treat 404 from `/practitioners/{userId}` as "no Practitioner panel" (graceful skip), separate from a 404 on `/users/{userId}` (renders `<EntityNotFound>`).

- **R4 — `useDirtyGuard` + programmatic navigation after save.** After a successful save the form calls `navigate()` while `isDirty` is still true for a render tick. **Mitigation:** call `dirtyGuard.dismiss()` before the post-save `navigate()` (already proven in `#2.5` tests).

- **R5 — Cross-tenant edit attempts.** Backend MUST reject with 403; tenant-scoping is already enforced at the service layer. Frontend doesn't expose cross-tenant IDs but defense-in-depth.

## Migration Plan

No data migration. Additive endpoints + new routes. Rollback = revert PR.

## Open Questions

- **Q1 — Should the list page render a "Show deactivated" toggle by default off?** Lean off (most admins want active users); the `Actief` filter is already exposed so the toggle is moot. Decision: **no separate toggle**, just the existing filter. Locked.
- **Q2 — Should the create form support specifying initial PractitionerRole rows (e.g. "create caregiver attached to org X with code Y")?** Out of scope — `#5` owns affiliation editing. Decision: **no**, locked.
