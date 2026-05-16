# Change chain — orchestrator admin UX

The 7-change chain that lifts `apps/orchestrator` from "patient list + user list" to a working admin + caregiver surface covering users, organisations, practitioner roles, care teams, and patient profiles.

> Sibling tracker to `CHAIN.md` (FHIR foundation). Operates the **same way**: order below is source of truth; each change in the chain depends on **all** prior `requires` being merged (or applied + tests green on the integration branch). Do not start a downstream change before its upstream is in.

Coordinated by the temporary project skill `.claude/skills/orchestrator-admin-ux-chain/`. **Both this file and that skill are removed by the final task of `care-teams-ui`.**

## Order

```
1. practitioner-role-split
     └─ requires: care-teams-base (archived in main), patients-base (archived), organisations-base (archived), user-base (archived)
     └─ modifies: user-base (drop user.organisation_id), care-teams-base (Participant.acting_as_practitioner_role_id; drop on_behalf_of_organisation_id)
     └─ adds:    practitioner-role-split capability (Practitioner + PractitionerRole + visibility rewrite)

2. caregiver-shell
     └─ requires: practitioner-role-split (archived) — typed client must already speak new shape
     └─ modifies: app-layout (route group, auth shell), patients-base (list page uses shared filterable list scaffolding)
     └─ adds:    caregiver-shell capability (nav, auth shell, landing, filterable DataTable primitives)

2.5 entity-page-scaffolding
     └─ requires: caregiver-shell (archived)
     └─ modifies: none (additive chrome + hooks under apps/orchestrator)
     └─ adds:    entity-page-scaffolding capability (EntityDetailPage, EntityFormPage, useEntityForm, useDirtyGuard, useEntityDelete, shared `entity-page` i18n namespace)

3. users-admin-ui
     └─ requires: practitioner-role-split (archived), caregiver-shell (archived), entity-page-scaffolding (archived)
     └─ modifies: user-base (no spec changes; consumes typed client only)
     └─ adds:    users-admin-ui capability

4. organisations-admin-ui
     └─ requires: practitioner-role-split (archived), caregiver-shell (archived)
     └─ modifies: organisations-base (no spec changes; consumes typed client only)
     └─ adds:    organisations-admin-ui capability

5. practitioner-roles-admin-ui
     └─ requires: practitioner-role-split (archived), caregiver-shell (archived), users-admin-ui (merged), organisations-admin-ui (merged)
     └─ modifies: practitioner-role-split (no spec changes; consumes typed client only)
     └─ adds:    practitioner-roles-admin-ui capability

6. patient-profile-ui
     └─ requires: practitioner-role-split (archived), caregiver-shell (archived)
     └─ modifies: patients-base (consume typed client only)
     └─ adds:    patient-profile-ui capability

7. care-teams-ui
     └─ requires: practitioner-role-split (archived), caregiver-shell (archived), users-admin-ui (merged), patient-profile-ui (merged)
     └─ modifies: care-teams-base (consume typed client only); deletes the temporary chain coordinator skill + this tracker as its final task
     └─ adds:    care-teams-ui capability
```

## Why this order

- **practitioner-role-split first**: separating `Practitioner` and `PractitionerRole` is a data-shape change. Every UI surface that lists users, shows affiliations, or filters by org would have to be rewritten if it shipped against the pre-split shape. Land it first, regen the typed client, then build UI against the final contract.
- **caregiver-shell second**: nav structure (hybrid: dashboard + inbox + patients + admin section), auth shell, landing page, and the shared filterable list scaffolding live here. Every other UI surface composes on top. Without it, each surface re-rolls a navbar.
- **`#3 + #4 + #6` parallel after `#2`**: users admin, orgs admin, and patient profile do not depend on each other. They can be drafted simultaneously in separate worktrees.
- **practitioner-roles-admin-ui after `#3 + #4`**: the affiliation editor picks a user (from `#3`) and an org (from `#4`); building it before they exist means re-writing pickers.
- **care-teams-ui last**: it embeds inside patient profile (`#6`) and picks users (`#3`). Also carries the cleanup task that retires this tracker + the coordinator skill.

## Concurrency rule

The seven changes MUST land in dependency order. The parallel set (`#3 + #4 + #6`) MAY be drafted in parallel worktrees and merged in any internal order — but no two of them on the same branch.

## Tracking

| # | Change | Branch | Worktree | Status |
| --- | --- | --- | --- | --- |
| 1 | `practitioner-role-split` | `feat/practitioner-role-split` | (removed) | **archived** (PR #10 merged 2026-05-16; archive id `2026-05-16-practitioner-role-split`) |
| 2 | `caregiver-shell` | `feat/caregiver-shell` | (removed) | **archived** (PR #11 merged 2026-05-16; archive id `2026-05-16-caregiver-shell`) |
| 2.5 | `entity-page-scaffolding` | `feat/entity-page-scaffolding` | `.worktrees/feat-entity-page-scaffolding` | in-progress (applied; awaiting commit + PR) |
| 3 | `users-admin-ui` | `feat/users-admin-ui` | `.worktrees/feat-users-admin-ui` | draft (worktree not yet created) |
| 4 | `organisations-admin-ui` | `feat/organisations-admin-ui` | `.worktrees/feat-organisations-admin-ui` | draft (worktree not yet created) |
| 5 | `practitioner-roles-admin-ui` | `feat/practitioner-roles-admin-ui` | `.worktrees/feat-practitioner-roles-admin-ui` | draft (worktree not yet created) |
| 6 | `patient-profile-ui` | `feat/patient-profile-ui` | `.worktrees/feat-patient-profile-ui` | draft (worktree not yet created) |
| 7 | `care-teams-ui` | `feat/care-teams-ui` | `.worktrees/feat-care-teams-ui` | draft (worktree not yet created) |

Update this file whenever a change advances state (draft → in-progress → applied → merged → archived).

## Cross-change touch matrix

| Concern | role-split | shell | entity-scaffold | users-ui | orgs-ui | pr-roles-ui | patient-ui | care-teams-ui |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Backend: `practitioners` table | adds | reads | — | reads | — | reads | — | — |
| Backend: `practitioner_roles` table | adds | reads | — | — | reads | adds-via-API | — | reads |
| Backend: `users.organisation_id` | drops | — | — | — | — | — | — | — |
| Backend: `care_team_participants.on_behalf_of_organisation_id` | replaces with `acting_as_practitioner_role_id` | — | — | — | — | — | — | reads |
| Backend: visibility predicate | rewrites (queries practitioner roles) | — | — | — | — | — | — | reads |
| Frontend: route group `_auth/admin/*` | — | adds | — | populates | populates | populates | — | — |
| Frontend: route `_auth/patients/$patientId` | — | scaffolding | — | — | — | — | adds/edits | embeds |
| Frontend: entity page chrome + hooks | — | — | adds | consumes | consumes | consumes | consumes | consumes |
| Frontend: typed client | regenerates | regenerates | — | consumes | consumes | consumes | consumes | consumes |
| Frontend: i18n keys | — | adds namespace | adds `entity-page` namespace | adds | adds | adds | adds | adds |

## Out of scope for this chain

- **Pathway builder + runtime UI** — under separate `feat/builder-base` worktree, independent chain.
- **Patient-facing app** — orchestrator is admins + caregivers only (project rule).
- **HiX SMART launch integration** — existing route + module untouched.
- **PractitionerRole M:N specialty CodeableConcept (open codes)** — chain ships narrow enum; widening is a future additive change.
- **CareTeam.managingOrganization** — deferred to MVP demand (BL-060).
- **Real FHIR resource serialization** — adapter work at integration time (BL-025).

## Coordinator skill

`.claude/skills/orchestrator-admin-ux-chain/SKILL.md` is a temporary project skill that:
- knows the dependency graph above,
- knows the per-spec workflow (start / verify / push / PR / archive),
- self-removes via the final task in `care-teams-ui`.

Read the skill before invoking any chain operation. Trigger by mentioning a chain spec name or asking "what's next in the UX chain".
