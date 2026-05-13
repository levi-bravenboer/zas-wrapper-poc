## Context

Backend ships auth + system routers only; persistence is in-memory; FHIR-shaped placeholders linger from `backend-setup` section 12. Orchestrator ships app shell + auth + a full SMART-on-FHIR launch module that scope.md now excludes from PoC.

Scope ledger (`openspec/scope.md`) defines `F1`..`F8` and the hard invariants: never an MDR medical device, no real patient data, FHIR-ready *seam* (not FHIR-built), Belgian hosting for production. This change aligns the stack to that ledger.

## Goals / Non-Goals

**Goals:**

- Remove FHIR scaffolding + SMART launch from PoC code paths.
- Land the domain spine (`pathway-domain`) so F1–F8 have something to talk to.
- Stand up minimal routers + UI surfaces for F2–F8 (skeleton, not feature-complete).
- Preserve the FHIR-ready seam: HiX adapter exists, signature is non-FHIR; swap-in at `[mvp]`.
- Make persistence real (SQLAlchemy + Alembic) — required by every F2–F8 surface.

**Non-Goals:**

- Composer drag-and-drop, full block library, pathway versioning — follow-up `[poc]` changes.
- Live HiX / Luscii / IdP — `[mvp]`.
- Notifications, HiX embed, two-way task sync — `[mvp]`.
- Patient surface (`F5` is **caregiver-side** viz only; patient-facing UI is `[mvp]` per `BL-014`).
- Any MDR-adjacent logic. Luscii block stays opaque static JSON.

## Decisions

### Persistence: SQLAlchemy 2.x + Alembic, SQLite (dev) / Postgres-ready (prod)

- **Why**: PoC needs real persistence for pathways, patients, tasks, users. In-memory blocks F4 filtering, F6 task state mutation, F8 admin assignment.
- **Why SQLAlchemy 2.x async**: matches FastAPI's async story; mature; works against SQLite for the worktree and Postgres later without code change.
- **Why Alembic**: migration baseline is required even for PoC — schema will change as F3 composer hooks land. Avoids stop-the-world rewrites.
- **SQLite for dev only**. Settings selects DSN; tests use `sqlite+aiosqlite:///:memory:`; staging would use Postgres. Belgian hosting (`[mvp]`) drives Postgres choice.
- **Alternative considered**: Tortoise ORM (simpler), raw asyncpg. Rejected — SQLAlchemy is the de-facto FastAPI stack and migrations are unavoidable.

### Pathway domain shape

- **Care pathway** = `Pathway { id, name, blocks: [Block], owner_id }`.
- **Block** = discriminated union: `AppointmentBlock`, `DecisionBlock`, `MilestoneBlock`, `EmailBlock`, `HixTaskBlock`, `LusciiCarePathBlock { static_payload: dict }`. Block list is **extensible** — F3 follow-up will add more.
- **PathwayEnrollment** = `{ id, pathway_id, patient_id, current_block_id, completed_block_ids }`. One enrollment per patient (scope: every patient is in exactly one pathway).
- **Task** = `{ id, enrollment_id, block_id, title, status: pending|done, completed_at, completed_by }`. Generated when the runtime advances onto a block that produces a task; later block types may produce zero or many tasks.
- **Runtime** for PoC is **deterministic + linear**: enrollment → advance through blocks in saved order. Decision blocks render but don't branch yet — that lands with the composer follow-up.
- **Why store blocks as JSON in `Pathway.blocks` column** instead of normalised rows: PoC; we mutate the shape every week; JSON column keeps schema diff cost zero. Trade-off: no FK integrity on block ids. Acceptable for PoC, revisit at `[mvp]`.

### HiX adapter narrowing

- Keep `HixClient` Protocol, narrow to `async def ping() -> None` only. Stub returns immediately.
- **Why keep the Protocol**: it's the FHIR-ready seam. At `[mvp]` we restore FHIR verbs (`read`, `search`, `create`). The seam belongs to current architecture even though no code calls FHIR verbs today.
- Drop `app/schemas/fhir.py`, `app/adapters/hix/_fixtures.py`, `tests/fixtures/fhir.py`.

### SMART launch removal

- Delete `apps/orchestrator/src/modules/smart-launch/` and `src/routes/launch.tsx`.
- Spec `smart-launch-stub` gets a delta with `## REMOVED Requirements` covering every requirement currently in it.
- Auth becomes the only entry point: `/login` → `/` (dashboard). No `/launch?iss=...` path.
- **Why delete vs dormant**: smart-launch-stub was implemented PoC code, not a dormant proposal. Code that isn't wired and isn't tested rots. Restore at `[mvp]` from the archived `smart-launch-stub` spec.

### Auth model

- `User { id, username, password_hash, role: caregiver|admin }`.
- Bootstrapped admin seeded via Alembic data migration (synthetic username/password; never real).
- Role check middleware: admin-only routers protected; caregiver routers protected against unauthenticated only.

### OpenAPI / typegen contract

- Backend ships OpenAPI as today; orchestrator regenerates `lib/api/schema.d.ts` after each backend router lands.
- Moon task: `moon run orchestrator:typegen` reads backend OpenAPI export. Already wired by `backend-setup`; we'll feed it the new routers as they land.

### F5 viz strategy

- F5 pathway viz = read-only vertical list of blocks with current-block highlight; Luscii block expanded inline showing static JSON (debug-style render in PoC).
- **Why this minimal render**: scope says "rendered from static JSON, no live Luscii". Anything richer drifts toward looking like Luscii Vitals (which is `[mvp]`).

### Module structure (orchestrator)

- One module per F: `modules/pathway/`, `modules/patient/`, `modules/task/`, `modules/admin/`. Module-scoped api / hooks / keys / schemas, per orchestrator AGENTS.md.
- Routes wire to modules; no route-level business logic.
- Dashboard becomes a thin route reading from `modules/dashboard/` which composes counts.

## Risks / Trade-offs

- **Migration baseline risk**: introducing Alembic + the first migration in the same change. → Mitigation: dedicated tasks section, baseline migration verified by `alembic upgrade head` against fresh SQLite, golden-path tested locally before merge.
- **Scope creep risk**: "skeleton" surfaces are tempting to over-build. → Mitigation: per-F task list explicitly bounds scope; richer interactions are follow-up changes.
- **Block-shape churn**: storing blocks as JSON means refactors are migration-free, but old enrollments may reference removed block kinds. → Mitigation: PoC seed data is regenerated each migration; no production migration cost at `[poc]`.
- **Deletion of working SMART code**: someone may want it back at `[mvp]`. → Mitigation: archived spec + commit history; the implementation patterns survive even if the code doesn't.
- **MDR boundary risk**: F5 viz could drift toward clinical decision UI if we add "summary" or "interpretation" on top of Luscii JSON. → Mitigation: hard rule — F5 renders the Luscii block as-is; any interpretation lands in `openspec/mdr-watchlist.md` first.

## Migration Plan

1. **Backend cleanup** lands before backend additions — keeps each commit reviewable.
2. **Domain models + Alembic baseline** lands as one commit; `alembic upgrade head` proven against fresh SQLite.
3. **Routers** land one F at a time; OpenAPI regenerated per router.
4. **Orchestrator cleanup** (SMART launch removal) lands before orchestrator additions.
5. **Orchestrator surfaces** land per F, consuming the new OpenAPI types as each backend router merges.
6. **Verification** runs `moon ci` end-to-end; manual demo path: login → dashboard → create pathway → enroll seeded patient → see pathway viz → complete a task.

Rollback: revert per commit; alembic downgrades to baseline-zero (empty schema). No PoC data is real — wiping the DB is free.

## Open Questions

- Should F3 composer-skeleton expose a JSON-edit textarea for adding blocks in PoC, or only render a "saved pathways" list with a hard-coded sample pathway? **Default**: textarea, gated behind a "dev composer" toggle so the demo path uses the seeded pathway. Confirm with user before implementing F3 UI tasks.
- Where does the bootstrapped admin password live? **Default**: env var `BOOTSTRAP_ADMIN_PASSWORD` with a fallback only in dev settings; tests stub it. No real password is ever committed.
- Does the orchestrator regen its api schema in CI or pre-commit? Existing `backend-setup` decision applies — keep as today.
