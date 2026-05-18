**Tier**: chain — orchestrator-admin-ux #2.5

## Why

Five chain consumers (`users-admin-ui`, `organisations-admin-ui`, `practitioner-roles-admin-ui`, `patient-profile-ui`, `care-teams-ui`) each ship entity detail, create, and edit surfaces. Without a shared scaffolding they will diverge on header layout, save flow, dirty guard, delete UX, validation, and error states — producing five subtly different flows for what should be one mental model. `caregiver-shell` solved the same problem for list surfaces by introducing `<FilterableListPage>` before any consumer shipped; this change does the equivalent for entity detail / form pages.

## What Changes

- **Add capability `entity-page-scaffolding`** covering:
  - `<EntityDetailPage>` chrome (title + subtitle + back link + actions row, body slot)
  - `<EntityDetailSingleColumn>` + `<EntityDetailTabs>` body layouts (consumer picks)
  - `<EntityFormPage>` chrome (`PageHeader` + form body + sticky footer `Cancel` / `Save`); same component for create + edit, distinguished by `mode: 'create' | 'edit'` prop
  - `<EntityNotFound>`, `<EntityErrorCard>`, `<EntityDetailSkeleton>`, `<EntityFormSkeleton>` state components
  - `useEntityForm({ schema, defaultValues, onSubmit })` hook — wraps TanStack Form + Zod resolver + dirty tracking
  - `useDirtyGuard(isDirty)` hook — TanStack Router `useBlocker` + `beforeunload` + AlertDialog confirm
  - `useEntityDelete({ name, mutationFn, listPath })` hook — AlertDialog confirm + mutation + toast + redirect
  - New i18n namespace `entity-page` (nl) for shared copy: action labels, dirty-guard dialog, delete-confirm dialog, not-found body, error body
  - Route convention: `_auth/admin/<entity>/{index,new,$id/index,$id/edit}.tsx`
No existing capability requirements change in this change. The new `entity-page-scaffolding` capability owns the full contract; downstream consumers (`users-admin-ui`, `organisations-admin-ui`, `practitioner-roles-admin-ui`, `patient-profile-ui`, `care-teams-ui`) each modify their own capability when they compose the scaffolding.

Permission gating is **out of scope** — `_auth/admin/*` route group already gates on `session.user.role === 'admin'`; per-action permission rules arrive with a later change once the permission model lands.

## Capabilities

### New Capabilities

- `entity-page-scaffolding`: chrome + cross-cutting hooks for entity detail, create, and edit pages.

### Modified Capabilities

_None._ Each downstream consumer change adopts the scaffolding inside its own capability delta.

## Impact

- **Code**: new files under `apps/orchestrator/src/components/entity/`, `apps/orchestrator/src/hooks/entity/`, `apps/orchestrator/src/lib/i18n/locales/nl/entity-page.json`. Updates to `apps/orchestrator/src/lib/i18n/index.ts` to register the namespace.
- **APIs**: none — base is consumer-data-owned (consumers wire `useQuery` / `useMutation`).
- **Dependencies**: no new packages. Uses already-installed `@tanstack/react-form`, `zod`, `@tanstack/react-router`, `sonner`, and shadcn primitives (`form.tsx`, `alert-dialog.tsx`, `card.tsx`, `tabs.tsx`, `button.tsx`, `skeleton.tsx`).
- **Chain**: blocks #3 `users-admin-ui`, #4 `organisations-admin-ui`, #5 `practitioner-roles-admin-ui`, #6 `patient-profile-ui`, #7 `care-teams-ui`. CHAIN doc gets a row #2.5 and the dependency arrows update.
