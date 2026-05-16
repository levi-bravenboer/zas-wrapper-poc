## Why

A patient is cared for by **one or more practitioners over time**. The set switches: handovers, vacation, shift, specialist consults; internal and external (different organisation) caregivers cycle in and out; the same practitioner may leave and rejoin; teams overlap when a patient is treated under multiple conditions simultaneously. None of this is modelled today. `patients-base` ships with tenant-scope-only visibility; that demos but does not survive contact with a real ward where caregivers must only see *their* patients.

FHIR R4 has a direct answer: `CareTeam` (one per patient/condition) with `participant[]` rows that carry `member` (Practitioner), `role`, `period.start/end`, and `onBehalfOf` (Organization). HiX exports its Behandelteam this way. NewWave's external-caregiver federation will speak the same shape at MVP. Building it now — after `organisations-base` and `patients-base` are in — locks the access-control model and unblocks "my patients" UX, audit, and per-org rule application.

This change is #3 of the FHIR-foundation chain (see `openspec/changes/CHAIN.md`). It depends on `organisations-base` and `patients-base` being merged.

## What Changes

- Add `care_teams` table: one or more per patient, period-bounded, `status` (`active|inactive`), optional `category` (free FHIR codeable concept for future Encounter/EpisodeOfCare linkage; PoC: nullable).
- Add `care_team_participants` table: `(care_team_id, user_id, role_in_care, period_start, period_end, on_behalf_of_organisation_id, assigned_by, unassigned_by)`. Partial unique on `(care_team_id, user_id) WHERE period_end IS NULL` to prevent two concurrent open rows for same practitioner on same team. Same `(care_team_id, user_id)` pair MAY repeat over non-overlapping periods (handles leave-and-rejoin).
- Add `RoleInCare` enum: `primary | consulting | observer` (FHIR-aligned codes).
- Add API: `GET /patients/{patient_id}/care-teams` (list, current + history), `POST /patients/{patient_id}/care-teams` (create new team), `POST /care-teams/{id}/participants` (assign user), `PATCH /care-teams/{id}/participants/{user_id}` (change role-in-care; closes current row + opens new), `DELETE /care-teams/{id}/participants/{user_id}` (unassign; sets `period_end`).
- **MODIFIES `patients-base`**: `GET /patients` row filter for caregiver role now consults care-team participants. Admin still sees all in tenant. Caregiver sees patients where they have an open participant row OR (PoC fallback) patients in their own organisation subtree. `require_patient_access(patient_id)` dep body now consults care-team membership.
- Update seed: assign the demo caregiver to all demo patients (one team per patient, single open participant row).

## Capabilities

### New Capabilities

- `care-teams-base`: FHIR `CareTeam` + `CareTeam.participant` modelling for patient ↔ practitioners over time, with org affiliation per participant.

### Modified Capabilities

- `patients-base`: `GET /patients` visibility filter, `require_patient_access` body, and seed link care-team membership to caregiver visibility.

## Impact

- **Chain prerequisites**: `organisations-base` AND `patients-base` MUST be merged first.
- **Code**: `apps/backend/app/models/care_team.py`, `app/models/care_team_participant.py`, `app/core/enums/care_team.py`, `app/schemas/care_team/`, `app/services/care_team/`, `app/api/routers/care_team/care_team_router.py`, edits to `app/services/patient/patient_service.py` + `app/services/patient/deps.py`, Alembic revision, `scripts/seed_care_teams.py`.
- **APIs**: 5 new endpoints; 1 modified endpoint (`GET /patients` filter behaviour).
- **DB**: 2 new tables, 1 new enum (`role_in_care`), partial unique indexes for concurrent-participant constraint.
- **Dependencies**: no new runtime deps.
- **Future seams reserved**: `Encounter.participant` (per-visit), `EpisodeOfCare` (links to CareTeam), `PractitionerRole` M:N alongside `users.organisation_id` FK. All additive future changes.
- **Demo**: enables "my patients" view, hand-over flows, and per-caregiver row filtering required for any non-admin demo path.
- **Chain position**: change #3 of the FHIR-foundation chain. Last in the chain.
