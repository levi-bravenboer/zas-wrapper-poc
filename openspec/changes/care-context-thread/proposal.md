**Tier**: [poc]

## Why

`care-teams-base` lands the backend model + visibility filter for `CareTeam` + `CareTeam.participant`, but stops at the API boundary. Caregivers cannot manage participants from the orchestrator, the patient detail view has no "who is on this team" affordance, and there is no shared rule that future clinical entities (encounters, observations, conditions, medications, notes) MUST carry the same care-team affiliation so they inherit the same row-level filter. Without a convention now, every new entity will re-derive its own visibility story and the FHIR-aligned model will drift.

This change ships the orchestrator UI for the care-team domain on patient detail AND codifies the cross-cutting "care-context" convention that every future clinical entity follows. Doing them together keeps the convention concrete (the patient detail view is the first concrete consumer) and avoids a phase where the UI exists but the convention is implicit.

## What Changes

- Add `src/modules/care-team/` orchestrator module: typed client wrappers, react-query hooks, components for listing teams + participants on patient detail, and dialogs for create-team / add-participant / change-role / unassign-participant.
- Extend `src/routes/_auth/patients/$patientId/index.tsx` from placeholder to a tabbed detail screen with `Care team` as the first tab. Patient header shows the active care team affiliation as a slot the entity-context convention defines.
- Add a shared `EntityContextHeader` component under `src/components/layout/` that renders `{patient identity}` + `{active care team}` + `{acting-on-behalf-of organisation}` for any clinical-entity page. Patient detail mounts it first; every future clinical-entity route MUST mount it.
- Codify the `care-context` capability: every new clinical-entity backend route SHALL accept (or derive) `care_team_id` + `organisation_id` from the patient context and apply the same care-team visibility filter the `patients-base` modification establishes. Every new clinical-entity orchestrator route SHALL render `EntityContextHeader`. The capability spec carries the acceptance criteria that future change proposals reference.
- NL i18n namespace `care-team` registered; zero inline Dutch literals.
- `BL-NNN` follow-up filed for: organisations admin tree (read-only + counts), participant CSV import (later), encounter/observation entities (use the new convention).

## Capabilities

### New Capabilities

- `care-context`: orchestrator UI for care-team management on patient detail + the cross-entity convention that every future clinical-entity route threads `(care_team_id, organisation_id)` and renders the entity-context header.

### Modified Capabilities

- `patients-base`: detail route stops being a placeholder; gains a tab shell and renders `EntityContextHeader`. Soft-delete + overview behaviour unchanged.

## Impact

- **Chain prerequisites**: `care-teams-base` MUST be merged first (UI consumes its endpoints).
- **Code**:
  - Orchestrator: `src/modules/care-team/{api.ts,types.ts,components/*.tsx,dialogs/*.tsx}`, `src/components/layout/EntityContextHeader.tsx`, `src/routes/_auth/patients/$patientId/index.tsx` (tabbed shell), `src/lib/i18n/locales/nl/care-team.json`, namespace registration in `src/lib/i18n/index.ts`.
  - Convention: documented in `openspec/specs/care-context/spec.md`; cross-referenced from `apps/orchestrator/AGENTS.md` and `apps/backend/AGENTS.md` so future entity authors find it.
- **APIs**: zero new backend endpoints in this change — consumes `care-teams-base` routes.
- **DB**: no changes.
- **Dependencies**: no new runtime deps. Tabs primitive: shadcn `Tabs` (already in design-system per `add-datatable-base`).
- **Demo**: enables "open patient → see care team → reassign caregiver → reload overview reflects new visibility" demo path.
- **Future seams reserved**: the `care-context` capability defines the contract every later clinical-entity change MUST satisfy (encounters, observations, conditions, medications, notes). Adding an entity without it is a spec violation.
