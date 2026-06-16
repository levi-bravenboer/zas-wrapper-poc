## Why

**Tier**: `[poc]` (model-level), with explicit `[mvp]` hooks documented
**Linear**: TBD

The current pathway domain model is data-driven on a single generic ORM row:

- `PathwayBlock` is one ORM class for every block kind. The kind lives in `type: str` and the per-kind shape lives in `config: JSONB`.
- Block "behaviour" lives in a parallel `BlockTypeEntry` dataclass registry under `app/domain/pathway/blocks/<kind>/block.py`. Each kind is a CONSTANT instance, not a class.
- Edges are separate rows joining two blocks; they don't carry kind-specific data.
- Timing is a single field; the same shape is used at template time and at runtime, glued together with conventions.
- Builder-time deferred fields exist (`block_deferred_field.py`) but are bolted alongside the catalogue, not first-class on the block model.

This shape was right for the demo scaffold. It is wrong for the next round of work because:

1. **Per-block-kind behaviour is going to be richer.** Decision, Subpath, Bridge, MDO, External-program — each has its own validation, inputs, outputs, lifecycle. Encoding all of that in JSON-schema-on-a-string + a sibling registry hides invariants from the type system and from the IDE.
2. **Edges-as-rows model the wrong primitive.** What the builder actually composes is *which prior blocks does this block depend on, and on what predicate*. That's an `input_logic` list local to each block. Edges fall out as a derived view, not as authored objects.
3. **Builder time ≠ runtime time.** The builder authors *templates*: "duration: 2 days", "start 5 days after measurement-block completes", "wait until reviewer signs off". The runtime owns *instances*: a real `started_at`, a real `completed_at`, a real `due_at`. Same field doing both jobs invites bugs ("did this block start, or is this the template duration?").
4. **Deferred / runtime-supplied values need to be a first-class concept.** When a patient is enrolled, certain template fields stay unfilled and must be supplied at enrollment time (location, scheduled date, choice of measurement, …). The builder must mark which fields are deferred and how the enrollment form should render them; the runtime must validate every enrollment fills them.
5. **The next clinical surfaces depend on this.** Patient-facing carepath views, MDO scheduling, lab-result review — all need typed access to per-block fields, not "open the config blob and hope the right key is there".

This change reshapes the block / pathway / edge model so it carries the actual semantics, splits builder vs runtime cleanly, and treats deferred fields as first-class. It is a **model + storage redesign**; the builder UI and the runtime engine consume the new shape but are not rebuilt here.

Vocabulary note: in this change, **node ≡ block**. Both terms appear because the builder UI calls them nodes while the domain calls them blocks; this change keeps "block" as the canonical term and notes the alias where the builder API surfaces it.

## What Changes

### Block model — class hierarchy with shared base

`BaseBlock` carries the fields every block kind has: `name`, `description`, `lane_kind`, `icon`, `input_logic`, `timing_policy`, `deferred_fields`. Concrete subclasses (`AppointmentBlock`, `TaskBlock`, `DecisionBlock`, `SubpathBlock`, `BridgeBlock`, `MDOBlock`, `TreatmentBlock`, `ExternalProgramBlock`, `MessageBlock`, `EndPathwayBlock`, …) add their own kind-specific fields and override the per-kind hooks (`pre_requisites`, `actions`, `complete_if`, …).

This is a real class hierarchy at the domain level. At storage level it maps to SQLAlchemy via either single-table or joined inheritance (one of the open design decisions below). The `BlockTypeEntry` registry retires; each subclass is its own source of truth, and its metadata (label, icon, allowed lanes, supports_branches) lives as class-level attributes or `@classmethod` accessors.

### Connectivity model — `input_logic` per block; edges are a derived view

Each block carries an `input_logic` list naming the prior blocks it depends on, plus a predicate per dependency:

```
input_logic: [
  { node: "lab",                       rule: "if done" },
  { node: "task-lab-result-review",    rule: "data is there" },
  { node: "measurement",               rule: "if true wait 5 days" },
]
```

- `node` is a stable slug or id referencing another block in the same pathway template.
- `rule` is a typed predicate (closed vocabulary; see design D3).
- Multiple entries combine with an `aggregator` (`all_of`, `any_of`, `n_of_m`); defaults to `all_of`.

Decision-style branching (XOR, AND fan-out) is modelled by the producer block exposing typed `outputs`, and downstream blocks referencing the specific output in their `input_logic`. There is no separate edge row authored by the builder. The orchestrator may still materialise a derived `pathway_edge_view` for the canvas / topology queries, but it's a projection, not the source of truth.

### Timing model — two layers

- **`TimingPolicy` (template, builder-authored).** A typed value attached to each block describing relative or absolute timing rules:
  - `fixed_duration: 2 days`
  - `wait_after: { node: "scan", offset: 5 days }`
  - `due_within: 3 days of trigger`
  - `at_enrollment_picked_date` (deferred — actual datetime supplied at enrollment)
- **`BlockExecution` (runtime, instance-authored).** A separate row per (block × patient enrollment) holding concrete `scheduled_at`, `started_at`, `completed_at`, `due_at`, `state` (`pending | active | complete | skipped | failed`). The template never holds these; the runtime never authors timing policy. The two are joined by `block_template_id`.

### Deferred fields — first class on the block, validated at enrollment

Each block subclass declares which of its fields are *deferred*: marked as runtime-supplied. The template stores the slot definition (label, type, validation, default, optional/required); the enrollment store stores the actual value per patient instance.

Concrete shape (working sketch, to be refined in design):

```
class AppointmentBlock(BaseBlock):
    title:        str
    mode:         Literal["in_person", "video", "phone"]
    location:     str | Deferred[str]           # marker type: builder can flip to deferred
    duration_minutes: int
    scheduled_at: Deferred[datetime]            # always deferred — runtime-supplied per enrollment
```

The builder treats `Deferred[T]` as "ask at enrollment"; the API layer surfaces a typed enrollment-form descriptor. Open question: do we use Python typing tricks for this, or a sibling `DeferredFieldSpec` model — see D4.

### Pathway model

`Pathway` becomes a template aggregate carrying:

- Versions (existing concept, kept; one published version is active at any time).
- Lanes (existing concept, kept; `LANE_KIND_*` already there).
- Phases (existing concept, kept; day buckets on the canvas).
- Blocks (the new hierarchy, replaces today's `PathwayBlock`).

A `PathwayEnrollment` aggregate spawns when a patient is enrolled. It owns:

- The set of `BlockExecution` rows (runtime-state per block).
- The set of `DeferredFieldValue` rows (enrollment-time-supplied values).
- The patient identifier, enrolled care team, etc.

### Scope Bounds

- **In scope:** domain class hierarchy, ORM mapping strategy, `input_logic` shape + predicate vocabulary, timing model split, deferred-field representation, enrollment aggregate. Migration plan from current model.
- **Out of scope:** rewriting the builder canvas UI. The builder must keep working through the migration; its API contract is updated, but its React component tree is not redone here.
- **Out of scope:** building the runtime execution engine itself. This change ships the storage + domain shape it consumes; the engine lands in a follow-up change.
- **Out of scope:** rewiring Luscii / HiX adapters to the new shape. They continue to feed the old `PathwayBlock` through a compatibility shim during the transition; the migration plan in design.md sequences when they switch.
- **Out of scope:** orchestrator-side typed client regen — happens after the API surface stabilises.

## Impact

- **Affected specs:**
  - `pathway-domain` (new spec capability) — captures the block class hierarchy, input_logic vocabulary, deferred-field model.
  - `pathway-runtime` (new spec capability) — captures the enrollment aggregate + BlockExecution model.
  - `pathway-builder-api` (delta on the existing API contract) — the read/write shape changes; the orchestrator typed client regenerates.
- **Affected code (backend):**
  - `apps/backend/app/db/models/pathway/` — class hierarchy + new tables + migration.
  - `apps/backend/app/domain/pathway/blocks/` — replace `BlockTypeEntry` data-registry with class hierarchy.
  - `apps/backend/app/schemas/pathway/blocks.py` — Pydantic shapes per block kind (or generated from the domain hierarchy).
  - `apps/backend/app/api/routers/pathway/*` — read/write endpoints serve the new shape; old shape behind a compatibility flag during migration.
- **Affected code (orchestrator):**
  - Builder pages keep working through the typed client regen; per-block inspector components consume the per-kind typed shape.
- **MDR check:** the model itself doesn't introduce clinical decision logic — it's a builder/runtime storage shape. **But** Decision blocks plus `input_logic` predicates touch automated branching, which is borderline. A separate MDR entry must catalogue every shipped predicate kind and assert none of them encode clinical reasoning. See `mdr-watchlist.md` task in the migration plan.
- **Backwards compatibility:** during the transition, the old `PathwayBlock` rows are migrated into the new hierarchy via a one-shot Alembic data migration. The old API shape is exposed via a compatibility serialiser for one orchestrator release, then retired. The builder UI sees only the new shape after typegen lands.
- **Risk:** large change. Splits into staged sub-changes if the surface is too big to land safely; see "Sequencing" in design.md.
