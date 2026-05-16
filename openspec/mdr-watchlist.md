# MDR Watchlist

**Invariant:** we are **never** an MDR medical device (EU 2017/745). Keep this file short.

## When to add an entry

A proposal or implementation could push us toward MDR if it involves: clinical decision logic, diagnostic output, automated dosing/titration, anything used or labelled as a medical device, or interpreting Luscii measurements ourselves (instead of treating Luscii's clinical care path as an opaque sub-flow).

Stop. Add an entry. Propose a non-MDR alternative. Get a decision before proceeding.

## Entry template

```
### YYYY-MM-DD — <short title> (source: <change-name> | conversation | review>)
- **Trigger:** what would push us toward MDR.
- **Why wanted:** the use case driving the ask.
- **Non-MDR alternative:** the shape that keeps us out.
- **Decision:** chosen alternative | dropped | escalated. One line.
```

## Entries

### 2026-05-15 — patients-base scope check (source: patients-base)
- **Trigger:** none. `patients` stores identifiers (INSZ + reserved HiX namespaces) + demographics (`given_name`, `family_name`, `birth_date`, `gender`) + sync metadata (`source`, `external_*`, `last_synced_at`). No clinical state, no diagnostic logic, no decision output.
- **Why wanted:** demo orchestrator needs a tenant-scoped patient list + identifier upsert path for the Rugrevalidatie demo and the future HiX adapter.
- **Non-MDR alternative:** already chosen — separate clinical-data tables (`Encounter`, `Condition`, `Observation`) are queued behind a future change; `patients-base` keeps the row purely administrative.
- **Decision:** chosen — landed as-is. Re-verify this entry on any future field addition that introduces clinical semantics.

### 2026-05-15 — care-teams-base scope check (source: care-teams-base)
- **Trigger:** none. `care_teams` + `care_team_participants` store membership (`user_id`, `role_in_care`, `period_start/end`, `on_behalf_of_organisation_id`) only. Roles (`primary | consulting | observer`) are administrative routing labels, not clinical decision outputs; no triage logic, no automated assignment from clinical signals, no interpretation of measurements.
- **Why wanted:** demo orchestrator needs a participant-row visibility predicate so caregivers see only the patients they are administratively assigned to. Drives the patients-base list filter rewrite.
- **Non-MDR alternative:** already chosen — pathway-builder runtime, `Encounter.participant`, `EpisodeOfCare`, and any clinical-state-driven assignment are queued as follow-ups; this change stays administrative.
- **Decision:** chosen — landed as-is. Re-verify if `role_in_care` ever widens to encode clinical authority (prescriber, etc.) or if assignment becomes signal-driven.

### 2026-05-16 — practitioner-role-split scope check (source: practitioner-role-split)
- **Trigger:** none. `practitioners` stores `family_name`, `given_name`, `qualification` (free text); `practitioner_roles` stores `(practitioner, organisation, code, specialty?, is_primary, period)`. `code` is a closed enum of administrative role labels (`gp | physiotherapist | psychologist | nurse | physician | other`). No clinical decision logic, no diagnostic output, no signal-driven assignment.
- **Why wanted:** caregivers act under one or more org-scoped roles; visibility predicate keys off open roles to gate `GET /patients`. Roles are routing/affiliation metadata.
- **Non-MDR alternative:** already chosen — `qualification` is free text (not a registry credential we validate); `code` is a closed administrative enum; clinical reasoning stays out of this table. Widening to free `CodeableConcept` queued as BL-062.
- **Decision:** chosen — landed as-is. Re-verify if `code` ever drives clinical authority (e.g. prescribing rights) or if `qualification` becomes a validated credential.
