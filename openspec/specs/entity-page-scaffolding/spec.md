# entity-page-scaffolding Specification

## Purpose
TBD - created by archiving change entity-page-scaffolding. Update Purpose after archive.
## Requirements
### Requirement: Entity detail page chrome

The orchestrator SHALL ship `<EntityDetailPage>` at `apps/orchestrator/src/components/entity/EntityDetailPage.tsx`. It SHALL render `<PageHeader>` with the consumer-supplied `title`, optional `subtitle`, an optional back link target, and an `actions` slot rendered right-aligned in the header. It SHALL render a `body` slot below the header. It MUST own NO data, query state, or mutation state; consumers wire `useQuery` outside the component.

#### Scenario: Header and body slots render

- **WHEN** a consumer renders `<EntityDetailPage title="Jan Jansen" subtitle="Caregiver" back={{ to: '/_auth/admin/users' }} actions={<EditButton />} body={<EntityDetailSingleColumn>...</EntityDetailSingleColumn>} />`
- **THEN** the page header shows `Jan Jansen` and `Caregiver`, a back link points to `/_auth/admin/users`, the `<EditButton />` renders right-aligned in the actions row, and the single-column body renders below the header

#### Scenario: Component owns no data

- **WHEN** the source of `EntityDetailPage.tsx` is inspected
- **THEN** it MUST NOT import from `@tanstack/react-query` and MUST NOT call any `useQuery` / `useMutation` hook

### Requirement: Entity detail layouts

The orchestrator SHALL ship two body-layout components consumers compose inside the `body` slot of `<EntityDetailPage>`:
- `<EntityDetailSingleColumn>` at `apps/orchestrator/src/components/entity/EntityDetailSingleColumn.tsx` — renders a single column of stacked `<Card>` sections; consumers pass children.
- `<EntityDetailTabs>` at `apps/orchestrator/src/components/entity/EntityDetailTabs.tsx` — renders shadcn `<Tabs>` with a `tabs: { value, label, content }[]` prop and a `defaultValue` prop. URL state for the active tab MAY be added by the consumer; the layout itself stays controlled-prop only in v1.

#### Scenario: Single-column composes children as stacked cards

- **WHEN** a consumer renders `<EntityDetailSingleColumn><Card>...</Card><Card>...</Card></EntityDetailSingleColumn>`
- **THEN** the two cards render vertically with a consistent gap and the same horizontal padding as `<FilterableListPage>` (`px-6`)

#### Scenario: Tabs renders the configured tabs

- **WHEN** a consumer renders `<EntityDetailTabs defaultValue="overview" tabs={[{ value: 'overview', label: 'Overzicht', content: <Overview /> }, { value: 'history', label: 'Geschiedenis', content: <History /> }]} />`
- **THEN** two tab triggers render with the supplied labels and clicking each swaps the content panel

### Requirement: Entity form page chrome and sticky footer

The orchestrator SHALL ship `<EntityFormPage>` at `apps/orchestrator/src/components/entity/EntityFormPage.tsx`. It SHALL render `<PageHeader>` (title + subtitle + back link), a `body` slot for the form field tree, and a sticky footer with two buttons in this order: `Cancel` (variant `ghost`) and `Save` (variant `default`). It SHALL accept `mode: 'create' | 'edit'`, a `form` prop carrying the TanStack Form instance, a `onCancel` callback, and a `submitLabel?` override (default = `entity-page:actions.save`). The footer MUST stay pinned to the viewport bottom while the body scrolls; the body container MUST reserve bottom padding equal to or greater than the footer's rendered height.

#### Scenario: Footer pins to viewport bottom

- **WHEN** the form body content exceeds the viewport
- **THEN** the footer remains visible at the viewport bottom while the body scrolls underneath, and the last field is fully reachable above the footer (footer does not occlude content)

#### Scenario: Save button reads i18n label, calls form.handleSubmit

- **WHEN** the user clicks the Save button
- **THEN** the click handler MUST call the TanStack Form instance's `handleSubmit` (no direct `onSubmit` shortcut bypassing form-level validation)

#### Scenario: Cancel invokes consumer callback

- **WHEN** the user clicks the Cancel button
- **THEN** the consumer-supplied `onCancel` callback fires; the chrome MUST NOT itself call `router.navigate`

### Requirement: useEntityForm hook

The orchestrator SHALL ship `useEntityForm` at `apps/orchestrator/src/hooks/entity/useEntityForm.ts`. The hook SHALL accept `{ schema: ZodSchema, defaultValues, onSubmit, onSuccess? }` and SHALL return a TanStack Form instance plus `{ isDirty: boolean, isSubmitting: boolean, submit: () => Promise<void>, reset: () => void }`. The hook MUST adapt the Zod schema as the form's validator so that per-field errors flow through TanStack Form's `<FormMessage>` slot. Validation MUST fire on field blur AND on submit; the hook MUST NOT enable on-change validation by default.

#### Scenario: Zod schema produces inline field errors

- **WHEN** a consumer registers a field with a Zod schema that disallows empty strings, the user blurs the field empty, and the form re-renders
- **THEN** an inline `<FormMessage>` MUST render under the field with the Zod-issue message localised through `t('entity-page:form.required')` or the schema-supplied message

#### Scenario: isDirty flips on first edit

- **WHEN** the user types into any registered field after the form has mounted with `defaultValues`
- **THEN** `isDirty` MUST become `true` on the next render and remain `true` until `reset()` is called or `defaultValues` are re-applied

#### Scenario: Submit calls onSubmit then onSuccess

- **WHEN** the user submits a form whose schema validates and whose `onSubmit` resolves successfully
- **THEN** the hook MUST call `onSubmit(values)` first, await it, then call `onSuccess?(values)`; if `onSubmit` rejects, `onSuccess` MUST NOT fire

### Requirement: useDirtyGuard hook

The orchestrator SHALL ship `useDirtyGuard` at `apps/orchestrator/src/hooks/entity/useDirtyGuard.ts`. The hook SHALL accept `isDirty: boolean` and SHALL block in-app navigation via TanStack Router's `useBlocker` AND tab close / hard reload via a `beforeunload` listener while `isDirty` is `true`. When in-app navigation is attempted, the hook MUST render an AlertDialog with i18n copy `entity-page:dirty.{title,message,confirm,discard}` and only proceed with navigation when the user confirms discard. The hook SHALL expose a `dismiss()` method consumers call before programmatic navigation after a successful save.

#### Scenario: In-app navigation while dirty triggers dialog

- **WHEN** `isDirty === true` and the user clicks a `<Link>` inside the app
- **THEN** navigation is intercepted and the dirty-guard AlertDialog opens with the configured copy; clicking "Discard" (variant `destructive`) completes the navigation, clicking "Cancel" keeps the user on the route

#### Scenario: beforeunload prompt for tab close

- **WHEN** `isDirty === true` and the user closes the tab or triggers a hard reload
- **THEN** the browser's native `beforeunload` confirmation MUST fire

#### Scenario: dismiss disables the guard for the next navigation

- **WHEN** a consumer calls `dismiss()` after a successful mutation and then `router.navigate({ to: ... })`
- **THEN** the navigation MUST proceed without the dirty-guard dialog appearing

### Requirement: useEntityDelete hook

The orchestrator SHALL ship `useEntityDelete` at `apps/orchestrator/src/hooks/entity/useEntityDelete.ts`. The hook SHALL accept `{ name: string, mutationFn: () => Promise<void>, listPath: string, onSuccess? }` and SHALL return `{ isOpen: boolean, open: () => void, close: () => void, confirm: () => Promise<void>, isPending: boolean, dialog: ReactNode }`. The returned `dialog` SHALL be a fully-rendered shadcn `<AlertDialog>` instance bound to the hook's state, with i18n copy from `entity-page:delete.{title,message,confirm}` and the entity `name` interpolated into the title and message. On confirm, the hook MUST run `mutationFn`, then on success raise `toast.success` and navigate to `listPath`; on failure raise `toast.error` and keep the dialog open.

#### Scenario: confirm runs mutation and navigates

- **WHEN** the user clicks the delete action, the dialog opens, the user confirms, and the mutation resolves
- **THEN** `toast.success` fires AND the router navigates to `listPath` AND the dialog closes

#### Scenario: failure keeps dialog open

- **WHEN** the user confirms deletion and the mutation rejects
- **THEN** the dialog remains open, `toast.error` fires with the rejection message, and the router MUST NOT navigate

#### Scenario: dialog copy interpolates entity name

- **WHEN** the hook is configured with `name: 'Jan Jansen'`
- **THEN** the rendered dialog title contains the literal string `Jan Jansen`

### Requirement: Inline not-found and error states

The orchestrator SHALL ship two inline state components under `apps/orchestrator/src/components/entity/`:
- `<EntityNotFound>` — renders inside the body slot of `<EntityDetailPage>` when the consumer's load returns 404. Copy comes from `entity-page:notFound.{title,message}`. Includes a `<Link>` back to the parent list.
- `<EntityErrorCard>` — renders inline error copy (`entity-page:error.{title,message}`) with a `Retry` button bound to a consumer-supplied `onRetry` callback.

Detail routes MUST NOT redirect away on 404 or error; they MUST render the page chrome with the state component in the body.

#### Scenario: 404 renders inline in detail page

- **WHEN** a consumer's `useQuery` returns a 404
- **THEN** the page header still renders (with the static fallback title), and the body renders `<EntityNotFound>` instead of the detail layout

#### Scenario: Error card retry callback fires

- **WHEN** the user clicks the Retry button inside `<EntityErrorCard>`
- **THEN** the consumer-supplied `onRetry` callback fires exactly once per click

### Requirement: Detail and form skeletons

The orchestrator SHALL ship `<EntityDetailSkeleton>` and `<EntityFormSkeleton>` under `apps/orchestrator/src/components/entity/`. Both MUST match the chrome shape of their non-skeleton counterparts (header block + body block of comparable height) so that load → loaded transitions do not cause layout shift greater than 8 pixels in either axis.

#### Scenario: Skeleton renders header + body placeholders

- **WHEN** `<EntityDetailSkeleton>` mounts
- **THEN** a header-shaped placeholder and at least one body-shaped placeholder render, both using shadcn `<Skeleton>` primitives

### Requirement: Route convention for entity surfaces

Every entity surface in the orchestrator-admin-ux chain (`users-admin-ui`, `organisations-admin-ui`, `practitioner-roles-admin-ui`, `patient-profile-ui`, `care-teams-ui`) SHALL register its routes under `apps/orchestrator/src/routes/_auth/admin/<entity>/` (except `patient-profile-ui` whose patient routes already live under `_auth/patients/`) following this convention:
- `index.tsx` — list page, composes `<FilterableListPage>`
- `new.tsx` — create page, composes `<EntityFormPage mode="create" />`
- `$id/index.tsx` — detail page, composes `<EntityDetailPage>`
- `$id/edit.tsx` — edit page, composes `<EntityFormPage mode="edit" />`

After successful create, the route MUST navigate to `$id/index.tsx` of the newly-created entity. After successful edit, the route MUST navigate to `$id/index.tsx`. After successful delete, the route MUST navigate to the entity's `index.tsx`.

#### Scenario: Create success navigates to new entity's detail

- **WHEN** a `new.tsx` route submits successfully and the mutation returns an entity with `id: 'abc'`
- **THEN** the router navigates to `…/$id/index.tsx` resolved with `id=abc`

#### Scenario: Edit success navigates back to detail

- **WHEN** an `$id/edit.tsx` route submits successfully
- **THEN** the router navigates to `…/$id/index.tsx` (same entity)

#### Scenario: Delete success navigates to list

- **WHEN** a detail page's delete confirm resolves successfully
- **THEN** the router navigates to the entity's `index.tsx` (list)

### Requirement: Shared i18n namespace `entity-page`

The orchestrator SHALL register a new i18n namespace `entity-page` at `apps/orchestrator/src/lib/i18n/locales/nl/entity-page.json`. The namespace MUST contain at least these keys:
- `actions.save`, `actions.cancel`, `actions.delete`, `actions.back`, `actions.edit`, `actions.retry`
- `dirty.title`, `dirty.message`, `dirty.confirm`, `dirty.discard`
- `delete.title`, `delete.message`, `delete.confirm`
- `notFound.title`, `notFound.message`, `notFound.backToList`
- `error.title`, `error.message`
- `form.required`, `form.submitFailed`

No string rendered by any component in `apps/orchestrator/src/components/entity/` or hook in `apps/orchestrator/src/hooks/entity/` MAY be a literal user-visible string — every label MUST flow through `t('entity-page:...')`. The namespace MUST be registered in `apps/orchestrator/src/lib/i18n/index.ts`.

#### Scenario: Namespace registered

- **WHEN** the i18n index is inspected after this change ships
- **THEN** the `entity-page` namespace MUST appear in the registered namespaces array

#### Scenario: No raw user-visible strings in entity components

- **WHEN** the existing eslint rule `i18next/no-literal-string` runs over `components/entity/**` and `hooks/entity/**`
- **THEN** zero violations MUST be reported

