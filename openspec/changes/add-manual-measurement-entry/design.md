## Context

Measurements on a patient currently come exclusively from Luscii via a read-only live proxy (`luscii-patient-data` capability): the backend fetches on every request and persists nothing but localisation catalogues. There is no local write path and no in-product entry form.

This change adds the first **local** measurement store plus a dropdown-driven entry dialog. It is deliberately scoped to capture → persist → read-back; it does not merge into the Luscii "Metingen" charts and does not attach any clinical logic to the values. That keeps it clear of the display-only / MDR boundary that governs the Luscii surface.

Existing patterns this design reuses:
- `AuditableEntity` base (`app/db/base.py`) — gives `id`, audit columns, and soft-delete (`deleted_at`), consistent with `PatientLusciiConnection`.
- Patient-scoped routers live in `app/api/routers/patient/` under `/patients/{patient_id}/…`.
- Write routes guard with `PatientEditDep` (Keto `edit` verb), read routes with `PatientAccessDep` (`view`); both carry `# AUTH-HARDEN` markers.
- `CurrentUserDep` (`SessionUser`) yields the acting caregiver for `performer_id`.
- OpenAPI `operation_id`s drive the generated frontend client; `/openapi-sync` regenerates types in lockstep.

## Goals / Non-Goals

**Goals:**
- Persist manually-entered measurements in a FHIR `Observation`-style table, independent of Luscii.
- Expose guarded `POST` + `GET /patients/{patient_id}/observations`.
- Constrain measurement types to a server-side allow-list (heart rate only for now); new types are a data change, not a contract change.
- Provide an add-measurement dialog on the patient detail page with a type dropdown, value field, and timestamp.

**Non-Goals:**
- Merging local measurements into the Luscii "Metingen" charts (data + entry only this round).
- Any clinical logic on values: thresholds, scoring, alerts, colour-by-value, pathway feed (MDR-gated, deferred).
- Editing or deleting an observation after create.
- Measurement types beyond heart rate.

## Decisions

**FHIR Observation-style table over a flat measurement table.**
A new `observation` table with `code` / `code_system` / `value` / `unit` / `effective_date_time` / `performer_id` / `patient_id`. Rationale: the repo already speaks FHIR (`fhir-client`, identifier systems, Luscii LOINC-ish coding), so a coded shape aligns with conventions and makes a future merge with Luscii series — which are already instrument/item coded — tractable. Alternative considered: a minimal `(type, value, unit, recorded_at)` table — faster but would need reshaping the moment we want to interoperate with the coded Luscii data, so rejected.

**Server-side type allow-list, not a free `code` field.**
The create endpoint accepts a small `measurement_type` enum/key; the server resolves `code`, `code_system`, and `unit` from an allow-list entry and rejects anything else with `422 invalid.observation.unsupported_type`. Rationale: prevents clients minting arbitrary codings, keeps units canonical, and makes "add a new supported type" a one-line data change. Heart rate = LOINC `8867-4`, unit `beats/min`.

**Reuse `PatientEditDep` / `PatientAccessDep` guards.**
Create uses `PatientEditDep` (same predicate as `PATCH /patients/{id}`), list uses `PatientAccessDep`. No new permission slug — entering a measurement is an edit on a patient the caregiver already has edit access to. `performer_id` comes from `CurrentUserDep`.

**Dialog reuses the existing form stack.**
`AddMeasurementDialog` follows the `EditPatientDialog` pattern (shadcn `Dialog` + the project's form hook). Type dropdown is a shadcn `Select` sourced from the supported-types list; submit is disabled until a type is chosen and the value parses as a number. On success: invalidate the observations query, close.

## Risks / Trade-offs

- **Two places measurements live (Luscii vs local), not unified** → Accepted for this round; the dialog/section is clearly "local". A later change can merge series once display strategy is decided. Documented as a non-goal so it is not mistaken for completeness.
- **Local values look clinical but carry no safeguards** → Mitigation: hard non-goal on any logic/threshold/alert; values render exactly as entered. Crossing that line requires an `openspec/mdr-watchlist.md` entry first.
- **Coding drift if the allow-list and any future Luscii merge disagree on codes** → Mitigation: allow-list is the single source for code/system/unit; pick LOINC `8867-4` now to match common Luscii heart-rate coding.
- **Client sends a bogus unit/code** → Mitigation: server ignores client coding and derives it from the allow-list entry.

## Migration Plan

1. Add the `Observation` model; generate one Alembic migration (`/new-migration`) creating the `observation` table (+ index on `patient_id`, `effective_date_time`).
2. Ship backend schemas, service, router; register routes.
3. Run `/openapi-sync` to regenerate `openapi.json` + frontend types.
4. Add frontend client functions + `AddMeasurementDialog` + patient-detail trigger + i18n keys.
5. Rollback: drop the `observation` table (no data dependencies; Luscii path untouched).

## Open Questions

- Should the patient detail page also show a read-back list of local observations now, or only the add affordance? Spec includes a `GET` endpoint regardless; surfacing a list view can be a thin follow-up if not wanted this round.
