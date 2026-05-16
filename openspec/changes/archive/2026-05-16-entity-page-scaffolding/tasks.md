## 0. Chain prerequisite

- [x] 0.1 Verify `caregiver-shell` is archived in `openspec/changes/archive/` (lookup id `2026-05-16-caregiver-shell`); bail if not
- [x] 0.2 Confirm `<PageHeader>`, `<FilterableListPage>`, shadcn `form.tsx` / `alert-dialog.tsx` / `card.tsx` / `tabs.tsx` / `skeleton.tsx`, and `<Toaster>` are present in `apps/orchestrator/src/`

## 1. i18n namespace

- [x] 1.1 Create `apps/orchestrator/src/lib/i18n/locales/nl/entity-page.json` with keys: `actions.{save,cancel,delete,back,edit,retry}`, `dirty.{title,message,confirm,discard}`, `delete.{title,message,confirm}`, `notFound.{title,message,backToList}`, `error.{title,message}`, `form.{required,submitFailed}`
- [x] 1.2 Register `entity-page` namespace in `apps/orchestrator/src/lib/i18n/index.ts`
- [x] 1.3 Confirm i18next typed-resources picks up the new namespace (build / typecheck clean)

## 2. Hooks

- [x] 2.1 Create `apps/orchestrator/src/hooks/entity/useEntityForm.ts` — wraps `@tanstack/react-form` + Zod schema adapter; exposes `{ form, isDirty, isSubmitting, submit, reset }`; validation on blur + submit; no on-change
- [x] 2.2 Create `apps/orchestrator/src/hooks/entity/useDirtyGuard.ts` — combines TanStack Router `useBlocker` + `beforeunload` listener + inline AlertDialog; exposes `{ dialog, dismiss }`; copy via `entity-page:dirty.*`
- [x] 2.3 Create `apps/orchestrator/src/hooks/entity/useEntityDelete.ts` — owns AlertDialog state, mutation call, `sonner` toast, redirect to `listPath`; exposes `{ isOpen, open, close, confirm, isPending, dialog }`; copy via `entity-page:delete.*`
- [x] 2.4 Add a barrel `apps/orchestrator/src/hooks/entity/index.ts`

## 3. State components

- [x] 3.1 Create `apps/orchestrator/src/components/entity/EntityNotFound.tsx` — inline body with `entity-page:notFound.*` copy + `<Link>` back to `backTo` prop
- [x] 3.2 Create `apps/orchestrator/src/components/entity/EntityErrorCard.tsx` — `<Card>` with `entity-page:error.*` copy + `Retry` button bound to `onRetry` prop
- [x] 3.3 Create `apps/orchestrator/src/components/entity/EntityDetailSkeleton.tsx` — `<Skeleton>` blocks matching `<PageHeader>` + single `<Card>` body
- [x] 3.4 Create `apps/orchestrator/src/components/entity/EntityFormSkeleton.tsx` — `<Skeleton>` blocks matching `<PageHeader>` + 3 field rows + footer bar

## 4. Detail page chrome

- [x] 4.1 Create `apps/orchestrator/src/components/entity/EntityDetailPage.tsx` — `<PageHeader title sub back actions />` + body slot; props `{ title, subtitle?, back?, actions?, body }`; consumer-data-owned (no `useQuery` import)
- [x] 4.2 Create `apps/orchestrator/src/components/entity/EntityDetailSingleColumn.tsx` — wraps children in stacked `<Card>` layout with `px-6` body padding matching `<FilterableListPage>`
- [x] 4.3 Create `apps/orchestrator/src/components/entity/EntityDetailTabs.tsx` — shadcn `<Tabs>` with `tabs: { value, label, content }[]` + `defaultValue` props; controlled-prop-only in v1

## 5. Form page chrome

- [x] 5.1 Create `apps/orchestrator/src/components/entity/EntityFormPage.tsx` — `<PageHeader>` + body slot + sticky footer with `Cancel` (`ghost`) + `Save` (`default`); props `{ mode: 'create' | 'edit', title, subtitle?, back?, form, onCancel, submitLabel?, body }`
- [x] 5.2 Sticky footer behavior: body container uses `pb-<footer-height>`, footer absolutely pinned via flex column + `mt-auto` OR `sticky bottom-0` — pick whichever matches existing `<Shell>` constraints
- [x] 5.3 Save button click calls `form.handleSubmit()` (NOT a shortcut that bypasses TanStack Form validation)

## 6. Barrel + types

- [x] 6.1 Create `apps/orchestrator/src/components/entity/index.ts` re-exporting all components + their prop types
- [x] 6.2 Add a JSDoc summary at the top of `EntityDetailPage.tsx` and `EntityFormPage.tsx` mirroring the contract style used in `FilterableListPage.tsx`

## 7. Tests

- [x] 7.1 `apps/orchestrator/src/components/entity/__tests__/EntityDetailPage.test.tsx` — renders title / subtitle / actions / body slot; back link wires to `back.to`
- [x] 7.2 `apps/orchestrator/src/components/entity/__tests__/EntityDetailSingleColumn.test.tsx` — composes children with consistent gap + padding
- [x] 7.3 `apps/orchestrator/src/components/entity/__tests__/EntityDetailTabs.test.tsx` — renders tab triggers, switches content on click
- [x] 7.4 `apps/orchestrator/src/components/entity/__tests__/EntityFormPage.test.tsx` — footer Cancel calls `onCancel`, Save calls `form.handleSubmit()`, footer stays pinned (smoke test via fixture height)
- [x] 7.5 `apps/orchestrator/src/components/entity/__tests__/EntityNotFound.test.tsx` — renders i18n copy + back link
- [x] 7.6 `apps/orchestrator/src/components/entity/__tests__/EntityErrorCard.test.tsx` — clicking Retry fires `onRetry`
- [x] 7.7 `apps/orchestrator/src/hooks/entity/__tests__/useEntityForm.test.tsx` — Zod schema produces inline field errors; `isDirty` flips on edit; `submit` chains `onSubmit` → `onSuccess`; rejection skips `onSuccess`
- [x] 7.8 `apps/orchestrator/src/hooks/entity/__tests__/useDirtyGuard.test.tsx` — in-app navigation while dirty opens dialog (mocked router); `dismiss()` disables the guard for the next nav; `beforeunload` listener registered iff `isDirty`
- [x] 7.9 `apps/orchestrator/src/hooks/entity/__tests__/useEntityDelete.test.tsx` — confirm runs mutation, navigates on success, keeps dialog open on failure; toast fires in both paths

## 8. Verification

- [x] 8.1 `moon run orchestrator:lint` — 0 errors (warnings within existing baseline)
- [x] 8.2 `moon run orchestrator:typecheck` — green
- [x] 8.3 `moon run orchestrator:test` — all tests green
- [x] 8.4 `moon run orchestrator:build` — green; bundle delta within tolerance

## 9. Docs + follow-ups

- [x] 9.1 Update `openspec/changes/CHAIN-orchestrator-admin-ux.md`: insert row `#2.5 entity-page-scaffolding` between `#2 caregiver-shell` and `#3 users-admin-ui`; add to dependency notes ("`#3 + #4 + #6` parallel after `#2.5`"); add to cross-change touch matrix
- [x] 9.2 `openspec validate entity-page-scaffolding --strict` clean
- [x] 9.3 Confirm new components / hooks render at least once in an existing test fixture (so coverage is not 0%); no end-user smoke test ships in this change because there is no consumer route yet
