---
name: design-list-overview
description: Run a structured intake before building a new list/overview page that uses `DataTable<T>`. Captures resource, columns, filters, sort, row-click target, expanded row, row actions, bulk actions, realtime topic, state persistence, permissions, and copy — then scaffolds the route + columns file + api file aligned with `apps/orchestrator/AGENTS.md` §25 (Lists & DataTable) and `apps/backend/AGENTS.md` (List endpoints).
metadata:
  author: zas-wrapper
  version: "1.0"
---

Use this skill **before writing any code** when the user asks for a new overview / list / table page.

It runs a structured intake so the resulting page satisfies:
- `apps/orchestrator/AGENTS.md` §25 "Lists & DataTable" rules
- `apps/backend/AGENTS.md` "List endpoints" rules
- The conventions established by the `add-datatable-base` change

---

## When to invoke

Trigger on phrasings like:
- "add an overview of …"
- "we need a list page for …"
- "build a table that shows …"
- "I want a screen where the clinician can see all …"

Do **not** trigger for: single-record detail pages, dashboards, embedded mini-tables that are part of a parent screen.

---

## Step 1 — Read the rulebooks first

Before asking anything, read:
1. `apps/orchestrator/AGENTS.md` (especially §25 Lists & DataTable)
2. `apps/backend/AGENTS.md` (List endpoints subsection)
3. `openspec/scope.md` to confirm the work fits the current tier

If the user's idea is out-of-tier, STOP and add a `BL-NNN` entry to `openspec/backlog.md` instead.

---

## Step 2 — Intake (ask in this order)

Use the **AskUserQuestion** tool. Batch related questions in a single call when possible. Where the answer is naturally free-form (e.g. column list), use one open-ended question.

### 2.1 Resource identity

- **Plural resource name** (kebab-case, e.g. `care-pathways`). Drives backend URL `/api/<plural>` and frontend route `/_auth/<plural>`.
- **Singular** (e.g. `care-pathway`). Drives the TS type / module folder.
- **i18n namespace** (default: same as plural).

### 2.2 Row shape

Open-ended: ask for the row fields with type hints. Example reply:
```
id: UUID
title: string
status: 'open' | 'closed' | 'pending'
owner: { id: UUID, name: string, initials?: string }
updated_at: ISO datetime
```

Convert to a `<Singular>Row` interface in the columns file.

### 2.3 Columns

For each column, capture:
- `id` (matches data key when possible)
- `header` (i18n key)
- `cell` — plain text / badge / avatar / custom React node?
- `sortKey` (optional — must be in backend `orderable_fields`)
- `filterKey` (optional)
- `sticky` (default first column = `true`)

**Cell helpers available** (don't reinvent):
- `Avatar` + `AvatarFallback` for people
- Status pill: `<span class="inline-flex … ring-1 ring-border/60">` + colored dot
- Timestamps: `toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })`

### 2.4 Default sort

- `default_order_by` (must be in `orderable_fields`)
- `default_order`: `asc` | `desc`

### 2.5 Row click

Pick one:
- **Navigate** to detail route (capture target path, e.g. `/_auth/care-pathways/$id`)
- **Expand** only (no nav)
- **None** (passive list)

### 2.6 Expanded row (if used)

- Trigger: chevron-only, or row click?
- Content: summary panel / sub-list / metadata grid?
- If the expand content needs an extra fetch, capture the query key + URL.

### 2.7 Row actions (kebab menu)

Per action: label (i18n), icon (`lucide-react`), handler (`onClick` or mutation), `destructive?`, permission gate.

Empty list = no kebab column.

### 2.8 Bulk actions (BulkBar)

Per action: label, backend endpoint (`POST /<plural>/<verb>`), request body, destructive?, confirm dialog?

Every bulk endpoint must return `BulkResult` and follow the `{ ids: UUID[] }` body shape (see backend AGENTS.md).

Empty list = `selectable={false}`.

### 2.9 Filters

For each filter:
- `type`: `select` | `multi` | `date-range` | `text`
- `key` (matches a `filterable_fields` entry on the backend repo)
- `label` (i18n)
- `options` (for select/multi — enum source)

Decide if filters live inline in the toolbar or behind the default Filters dropdown.

### 2.10 Search

- Searchable backend fields (`searchable_fields` on the repo).
- Placeholder copy.

### 2.11 Realtime

- `realtimeTopic` = backend model's `__realtime_resource__`. If the model has `None`, skip.
- Confirm the global `RealtimeInvalidationProvider` is mounted (it is, in `AppShell`).

### 2.12 State persistence

Pick exactly one (the AGENTS rule forbids combining):
- `useRouteSearchTableState(schema)` — URL-driven, shareable links
- `useLocalTableState(tableId)` — per-user, persists across reloads
- `useDataTableState()` — ephemeral, resets on nav

### 2.13 Permissions

- Role(s) allowed to read the list.
- Role(s) allowed to mutate (per row-action and per bulk-action).
- If the list is tenant-scoped, the backend repo handles isolation; no extra work.

### 2.14 Empty / loading / error copy

- Empty title + sub.
- Error title + retry label.
- Loading skeleton row count (default 5).

### 2.15 Page header

- `title` (i18n)
- `sub` (i18n)
- Optional `eyebrow`
- Optional `actions` (e.g. "Nieuw aanmaken")

---

## Step 3 — Summarise the design

Echo back a numbered list of every decision so the user can correct in one pass. Do **not** start writing files until the user confirms.

---

## Step 4 — Scaffold (only after confirmation)

Frontend:

```
apps/orchestrator/src/modules/<singular>/
  api.ts                              # list query key + bulk mutations
  components/
    <Singular>Columns.tsx             # COLUMNS + FILTER_DEFS + rowActions factory
  types.ts                            # <Singular>Row interface (or re-export from openapi)
apps/orchestrator/src/routes/_auth/<plural>/
  index.tsx                           # composes <DataTable />
apps/orchestrator/src/i18n/locales/nl/<plural>.json
```

Backend (if endpoint missing):

```
apps/backend/app/api/<plural>.py      # GET /<plural> + bulk routes
apps/backend/app/repositories/<plural>.py  # BaseListRepository[T] subclass
apps/backend/app/schemas/<plural>/    # schemas + Page[<Singular>]
```

Make sure the route file is a *thin composer* — column / filter / action defs live in `modules/<singular>/components/`, NOT in the route. ESLint won't catch this, but reviewers will.

---

## Step 5 — Verify before reporting done

Always quote the result of:
- `moon run orchestrator:typecheck`
- `moon run orchestrator:lint`
- `moon run orchestrator:test -- src/modules/<singular>`
- (backend) `moon run backend:test -- tests/api/test_<plural>.py`

If the user wants a visual smoke, point them at the demo route pattern (`src/routes/_auth/demo/data-table.tsx`) — never wire the new list into nav before review.

---

## Guardrails

- Never start scaffolding before the user has answered §2.1–§2.15 (or explicitly waived a section).
- Never invent enum values or filterable fields — pull them from the backend repo's `filterable_fields` / `orderable_fields` declarations.
- Never combine URL + localStorage state persistence.
- Never use raw `<table>` or import `@tanstack/react-table` directly. ESLint will block it.
- Never put user-visible Dutch literals in a `.tsx` file. Use i18n keys.
- If the user asks for clinical decision logic, automated dosing, or diagnostic output: STOP. Log to `openspec/mdr-watchlist.md` and propose a non-MDR alternative.
