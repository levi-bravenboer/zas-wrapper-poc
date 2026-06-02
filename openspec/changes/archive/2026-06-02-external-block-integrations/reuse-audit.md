# Reuse audit — Luscii block

Inventory of existing project infrastructure that the Luscii block work SHOULD reuse rather than reinvent. Cross-checked against the worktree as of design lock.

## Backend reuse

| Need | Existing artefact | Reuse strategy |
|---|---|---|
| Luscii adapter Protocol | `apps/backend/app/adapters/luscii/protocol.py` (`LusciiClient` with `ping()`) | **Extend** — add the generic `ExternalBlockClient` Protocol in `apps/backend/app/adapters/external_blocks.py`, then have the single Luscii client class implement BOTH protocols. Don't create a parallel "block-only Luscii client". One vendor module, multiple capability slices. |
| Luscii stub | `apps/backend/app/adapters/luscii/stub.py` (`LusciiStubClient`) | **Extend** — add `list_blocks`, `get_block_schema`, `resolve_block` methods alongside existing `ping()`. New methods query the `luscii_program` table; no parallel stub class. |
| Adapter factory + DI | `apps/backend/app/adapters/__init__.py` + `app/adapters/deps.py` (`get_luscii_client`, `build_luscii_client`, `LusciiClientDep`) | **Reuse as-is** — `get_external_block_client('luscii', settings)` from spec dispatches *through* `get_luscii_client(...)`. Stays consistent with the existing factory pattern. |
| Realtime event envelope | `apps/backend/app/realtime/events.py` (`RealtimeEvent(resource, action, id, v)`) | **Reuse directly** — publish `RealtimeEvent(resource='luscii_program', action='upsert'\|'delete', id=program_id)` after every mutation. Publish `RealtimeEvent(resource='external_block_provider', action=..., id=provider_code)` after registry changes. No new event type. |
| Realtime pubsub | `apps/backend/app/realtime/pubsub.py` + `flush_hook.py` | **Reuse as-is** — the flush hook already broadcasts events committed by repository code. New table writes go through the same hook. |
| JSONB column patterns | `pathway_block.config` (existing JSONB column elsewhere) | **Follow the same SQLAlchemy + Pydantic + Alembic pattern** for `luscii_program.data`. No new conventions. |
| Migration tooling | `moon run backend:make-migration "..."` | **Reuse** — single migration per concern (one for `external_block_provider`, one for `luscii_program`, one for seed). |
| Seed tooling | `moon run backend:seed`, `backend:seed-tenant`, `backend:seed-users` | **Extend** — add `backend:seed-luscii` task following the same idempotent `INSERT … ON CONFLICT DO UPDATE` pattern. |
| Block-type widening | `pathway-block-redesign` already established the `pathway_block.type` enum widening pattern | **Mirror** — same CHECK constraint widening + app-level validation flow. No new persistence shape. |

## Frontend reuse

| Need | Existing artefact | Reuse strategy |
|---|---|---|
| Realtime → query invalidation | `apps/orchestrator/src/providers/realtime-invalidation.tsx` (subscribes to SSE `/events`, invalidates `[event.resource]`) | **Reuse via key naming** — set TanStack Query keys whose **first element** matches the realtime `resource` string. Key `['external_block_provider']` auto-invalidates on `resource='external_block_provider'` push. Key `['luscii_program']` auto-invalidates on `resource='luscii_program'` push. No bespoke subscription logic, no custom listener. |
| TanStack key registry | `apps/orchestrator/src/modules/pathway/keys.ts` (`pathwayKeys`) | **Mirror the pattern** — add `apps/orchestrator/src/modules/external-blocks/keys.ts` exporting `externalBlockKeys = { ... }`. First element of every key = resource name (`external_block_provider`, `luscii_program`) so realtime invalidation just works. |
| Block palette / dock | `apps/orchestrator/src/modules/pathway/components/dock/BuilderDock.tsx` + `DockItem.tsx` | **Extend** — `BuilderDock` already iterates `catalogue: PathwayBlockType[]`. Since `GET /pathway-block-types` will return Luscii as an entry with `source='external'`, the Luscii item ships in the dock for free. Add provider-grouping logic inside `BuilderDock` (group by `source`, then by `provider`) — no new dock component. |
| Inspector drawer shell | `apps/orchestrator/src/modules/pathway/components/drawer/BuilderDrawer.tsx` (per-type inspector dispatch at line 18-25 + 56-59 via `CONFIG_SCHEMAS`) | **Extend the dispatch** — add a `case 'program'` (or external-block branch) that routes to a `LusciiProgramInspector` (new file alongside existing `PathwayLinkInspector` etc.). Header / close-button / accent chrome stays in `BuilderDrawer`. |
| Per-block inspector pattern | `inspectors/PathwayLinkInspector.tsx`, `AppointmentInspector.tsx`, etc. | **Mirror** — `LusciiProgramInspector.tsx` follows the same Props shape (`config`, `onChange`), same `InspectorField` wrapper, same `Select`/`Input`/`Button` shadcn primitives. |
| Inspector field wrapper | `inspectors/InspectorField.tsx` (label + hint + children) | **Reuse directly** — every Luscii inspector field uses `<InspectorField label=... hint=...>...</InspectorField>`. No new wrapper. |
| Config Zod schemas | `apps/orchestrator/src/modules/pathway/configSchemas.ts` (`CONFIG_SCHEMAS` map per semantics) | **Extend** — add a `program` semantics entry with the Zod schema (program_id / protocol_id / mode). `BuilderDrawer`'s `safeParse` block continues to work unchanged. |
| Block-type icon resolver | `apps/orchestrator/src/modules/pathway/blockCatalogue.tsx` (`BlockTypeIcon` consumes `icon: string`, resolves via `resolveLucideIcon`) | **Reuse directly** — Luscii block's `icon='activity'` (from registry seed) flows through `BlockTypeIcon` without any branch. |
| Lane accent / phase tint | `apps/orchestrator/src/modules/pathway/canvasLayout.ts` (`laneAccent`, `phaseTint`) and `constants/theme.ts` | **Reuse as-is** — Luscii block lives in `external` lane → accent already defined (`--lane-external: #b45309`). No new lane kind today. |
| xyflow node registration | `apps/orchestrator/src/modules/pathway/components/canvas/BuilderCanvasFrame.tsx` line 59 (`const NODE_TYPES = { block: BlockNode }`) | **Extend with a single dispatcher** — replace `BlockNode` registration with a thin `BlockNodeRouter` component that reads `block.type` and renders either `BlockNode` (native, bare codes) or `LusciiProgramBlockNode` (dotted code, `luscii.program`). Single xyflow type key; routing happens inside. Generalises to future providers without touching `NODE_TYPES`. |
| Node geometry helpers | `canvasLayout.ts` (`blockOrigin`, `BLOCK_DEFAULT_X`, `BLOCK_DEFAULT_Y`) | **Reuse + scale** — `LusciiProgramThumbnail` uses a mini-`blockOrigin` for its internal layout, parameterised on the computed viewBox. Same coord model. |
| useFlowNodes (block → xyflow node mapper) | `apps/orchestrator/src/modules/pathway/components/canvas/useFlowNodes.ts` | **Reuse** — node-creation logic stays; only the rendered component swaps via the dispatcher above. Node `data` shape passes through. |
| shadcn primitives (Select / Input / Button / Label / etc.) | `apps/orchestrator/src/components/ui/*` | **Reuse directly** — every Luscii inspector field and the program picker use existing primitives. Zero new UI primitives. |
| Type generation (Pydantic → TS) | `apps/orchestrator/src/lib/api/schema.d.ts` (regenerated via `moon run orchestrator:typegen` from `apps/backend/openapi.json`) | **Reuse the existing pipeline** — `LusciiProgramData` Pydantic schema flows through `/openapi-sync` as `components["schemas"]["LusciiProgramData"]`. Frontend imports from there. No hand-written mirror. |
| `/openapi-sync` slash command | `.claude/commands/openapi-sync.md` | **Reuse** — running it after backend changes keeps the FE types in sync with `LusciiProgramData`. |

## Auto-invalidation alignment — naming convention

The biggest free win is the realtime → TanStack invalidation chain:

```
backend mutation
  → publish RealtimeEvent(resource='luscii_program', action=..., id=...)
  → SSE /events
  → RealtimeInvalidationProvider
  → queryClient.invalidateQueries({ queryKey: [event.resource] })
  → any query with key starting ['luscii_program', ...] refetches
```

So the **resource name == table name == TanStack key prefix** is a deliberate three-way alignment, not a coincidence. Stick to it:

- DB table `luscii_program` → realtime resource `'luscii_program'` → query key `['luscii_program']`, `['luscii_program', programId]`
- DB table `external_block_provider` → realtime resource `'external_block_provider'` → query key `['external_block_provider']`, `['external_block_provider', providerCode]`

When a row changes, the matching frontend caches drop without a single bespoke subscription.

## Anti-patterns to avoid

1. **Don't create a parallel Luscii client just for blocks.** Extend the existing `LusciiClient` Protocol + `LusciiStubClient` class with the new methods. One client per vendor.
2. **Don't add a new xyflow node type key per provider.** Use the dispatcher pattern. `NODE_TYPES = { block: BlockNodeRouter }` stays the registration; routing happens inside.
3. **Don't write a new inspector drawer for Luscii.** Extend `BuilderDrawer`'s dispatch with a `program`/`luscii.program` branch.
4. **Don't write a bespoke realtime subscription for Luscii.** Name the resource right and let `RealtimeInvalidationProvider` invalidate by key match.
5. **Don't introduce a new Zod / form library for the Luscii config.** Extend `configSchemas.ts`.
6. **Don't write a new shadcn variant or UI primitive.** Use what's in `apps/orchestrator/src/components/ui/`.
7. **Don't hand-roll TypeScript types for `LusciiProgramData`.** Let `openapi-typescript` generate them.
8. **Don't add a new Alembic seed mechanism.** Follow the `backend:seed-*` task pattern with an idempotent upsert.
9. **Don't add a new realtime event envelope.** `RealtimeEvent(resource, action, id, v)` is enough.
10. **Don't bypass `get_external_block_client` factory in routes.** Route handlers depend on the factory (matches the `LusciiClientDep` / `HixClientDep` pattern in `app/adapters/deps.py`).

## Sub-decisions surfaced by the audit

These are small but should be locked before implementation:

1. **`ExternalBlockClient` Protocol location.** Spec says `app/adapters/external_blocks.py`. Confirms.
2. **Luscii client class structure.** One class implementing both `LusciiClient` (ping) and `ExternalBlockClient` (block methods). Stub variant likewise.
3. **xyflow dispatcher component name.** `BlockNodeRouter.tsx` in `apps/orchestrator/src/modules/pathway/components/canvas/nodes/`. Routes on `data.block.type` prefix.
4. **`externalBlockKeys` location.** `apps/orchestrator/src/modules/external-blocks/keys.ts` (new module, sibling to `pathway/`).
5. **Inspector dispatch key.** Add `'program'` to `BlockSemantics` enum (already a discriminator in `CONFIG_SCHEMAS`) — or dispatch on `block.type === 'luscii.program'`? Recommendation: extend `BlockSemantics` with `'external_program'` (generic) and let providers map their kinds onto it. Avoids a per-provider switch in `BuilderDrawer`.
