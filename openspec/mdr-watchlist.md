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

### 2026-06-22 — caregivers questioning patient data via AI (source: conversation / docs/research/ai-opportunity-mapping.md)
- **Trigger:** AI features that let caregivers ask natural-language questions about a patient and get answers synthesized from clinical data — deterioration questions over Luscii vitals, cross-source clinical summaries, cohort comparison, next-step recommendations, AI triage of a panel. All interpret clinical data rather than route/display it.
- **Why wanted:** product direction wants these high-value caregiver use cases in the AI opportunity mapping for a hospital pitch; "forget the no-MDR rule" requested in conversation.
- **Non-MDR alternative:** split the cluster by retrieval-vs-interpretation. **Verbatim ask-the-record** (returns source values + provenance, no synthesis, Luscii data display-only) stays non-MDR (`gate`). Anything that summarizes, trends, scores, compares, recommends, or triages from clinical signal is MDR `RISK` and stays out unless a per-item decision is recorded.
- **Decision:** scoped into the mapping for ideation only. No `RISK`-tagged item ships without its own watchlist entry + recorded MDR decision (alternative shape / accepted-with-rationale / escalated to regulatory). Verbatim retrieval may proceed at MVP behind the passthrough + provenance guardrails.

### 2026-06-22 — Luscii alert-flag passthrough in Metingen replica (source: luscii-measurements-view)
- **Trigger:** colouring measurement points/rows by Luscii's fired alert flag (red/orange) in the replica view — revisits the "no alerts" line of the 2026-06-10 decision.
- **Why wanted:** the replica must visually match Luscii's own Metingen screen, where measurements that crossed a threshold show a red/orange status dot. Caregivers expect the same cue.
- **Non-MDR alternative:** passthrough of Luscii's OWN fired alert flag, verbatim, joined by `measurementId` from `/v1/alerts`. We do NOT compute the flag, do NOT fetch or assert threshold ranges (the API exposes none), and do NOT shade threshold bands. Alerting logic stays entirely in Luscii; we only echo the flag Luscii already raised — same shape as echoing Luscii's labels/units. Threshold bands are explicitly dropped (no data + would be us asserting clinical ranges).
- **Decision:** escalated — engineering (Levi) requested; ships behind default-off frontend flag `VITE_LUSCII_METINGEN_REPLICA`, so nothing reaches caregivers until the PO confirms this passthrough is acceptable and the flag is flipped. Re-confirm with PO before enabling.

### 2026-06-10 — Luscii measurement display in patient view (source: luscii-patient-enrichment)
- **Trigger:** rendering Luscii measurement data (values, planned actions, programme/protocol) inside the Orchestrator patient view — adjacent to "interpreting Luscii measurements ourselves".
- **Why wanted:** caregivers need to see a linked patient's Luscii monitoring data without switching tools (BL-008, promoted to PoC).
- **Non-MDR alternative:** display-only passthrough. We decode `measurement.details` using Luscii's own item labels, units, and answer-text localisations and render them verbatim. No thresholds, no alerts, no scores, no trends, no colour-coding by value, no derived clinical signal — alerting stays in Luscii. The invariant is a named requirement ("Luscii data is display-only") in the `luscii-patient-data` spec; any future computed field must add a watchlist entry first.
- **Decision:** chosen — display-only passthrough, confirmed by product owner 2026-06-10. Re-verify on any change that computes anything from measurement values.
