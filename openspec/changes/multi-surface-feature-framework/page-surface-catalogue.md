## Page Surface Catalogue

This catalogue locks the surface(s) every existing orchestrator page targets. It is the source of truth for sections 5–7 of `tasks.md`: the generator's defaults, the migration scope, and the agent rules' "is this admin or clinical?" decision.

**Rule of thumb:**

- Pages that bind to **orchestrator concepts** (admin, configuration, proprietary workflow) → `app` only.
- Pages that bind to **clinical entities with a FHIR equivalent** (Task, Patient, Encounter, Observation, …) → `app` + at least one of `smart` / `embed`.
- `embed` is only useful when the host EPD does **not** already render the same view; otherwise it duplicates HiX's own chrome and breaks usefulness.

### Catalogue

| Page (current route) | app | smart | embed | Rationale |
| --- | --- | --- | --- | --- |
| `dashboard` (`/_auth/index`) | ✓ | — | — | Caregiver workspace home. Our chrome, our composition of tiles. No FHIR equivalent. |
| `tasks` (`/_auth/tasks`, `/s/tasks`, `/embed/tasks`) | ✓ | ✓ | ✓ | FHIR `Task` exists. Caregivers want their list inside an EPD launch (smart) and embedded in patient detail (embed). |
| `patients` list + detail (`/_auth/patients/*`) | ✓ | ✓ | — | FHIR `Patient` exists. SMART launch from EPD usefully renders our patient overview. Embed is redundant: HiX already renders the patient header. |
| `pathways` overview + builder + version (`/_auth/pathways/*`) | ✓ | — | — | Proprietary orchestrator concept. No FHIR equivalent. Embedding inside an EPD would require modelling pathways as `PlanDefinition`/`CarePlan` — out of scope. |
| `admin / organisations` | ✓ | — | — | Internal admin. Hospital does not need an iframe of our org tree. |
| `admin / practitioner-roles` | ✓ | — | — | Admin only. (FHIR `PractitionerRole` exists but the UI is admin housekeeping, not clinical context.) |
| `admin / users` | ✓ | — | — | Admin only. |
| `settings` | ✓ | — | — | App-level configuration. |
| `login`, `launch`, `launch.callback` | infra | infra | infra | Auth entry points — not features in the registry sense. |

### Admin opt-out

`admin / *`, `settings`, `pathways`, and `dashboard` are **app-only by intent**, not by accident. They MUST NOT be migrated through `gen:feature` and MUST NOT call `defineFeature`. The agent rules in section 6 SHALL recognise this opt-out: when an agent is asked to add an admin page (anything under `/_auth/admin/*`, `/_auth/settings`, `/_auth/pathways/*`) it MUST NOT prompt for surface selection.

### Future additions

Future clinical-entity views (encounters, observations, conditions, medications, notes, ePRO, …) default to `app` + `embed` and add `smart` when an EPD launch can usefully open them standalone. The agent rules SHALL prompt for surfaces before generating any such page; the catalogue above is the precedent template.
