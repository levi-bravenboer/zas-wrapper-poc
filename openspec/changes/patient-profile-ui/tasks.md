## 0. Chain prerequisite

- [ ] 0.1 Verify `practitioner-role-split` and `caregiver-shell` both `archived`

## 1. Route + page scaffold

- [ ] 1.1 Replace placeholder `_auth/patients/$patientId.tsx` with route loading `<PatientProfilePage>`
- [ ] 1.2 `<PatientProfilePage>` uses shadcn `Tabs` with three tabs: `Overzicht`, `Zorgteam`, `Geschiedenis`
- [ ] 1.3 Top-of-page sticky header: patient name, INSZ pill, DOB, organisation chip, kebab (`Bewerken`, `Verwijderen`)

## 2. Overzicht tab

- [ ] 2.1 `<PatientDemographicsPanel>`: name, dob, gender, primary org name (resolves via `GET /organisations` cache from caregiver-shell)
- [ ] 2.2 `<PatientIdentifiersPanel>`: list of `{system, value, use}` rows, INSZ pinned to top
- [ ] 2.3 Empty-state: never empty (patient always has demographics); identifiers panel shows "Geen identificatoren" line when zero rows

## 3. Zorgteam tab

- [ ] 3.1 `<CareTeamSlot>` placeholder component: renders `"Komt binnenkort — wordt geleverd door care-teams-ui"` plus a small list of current care teams (derived from `GET /care-teams?patient_id=…`) so the screen isn't empty
- [ ] 3.2 Document the slot contract so `care-teams-ui` replaces it cleanly: `<CareTeamSlot patientId={…} />` is the seam

## 4. Geschiedenis tab

- [ ] 4.1 `<PatientHistoryPanel>`: three rows max — `Aangemaakt op {created_at} door {created_by.display_name}`, `Laatst bewerkt op {updated_at} door {updated_by.display_name}`, optional `Soft-deleted op {deleted_at} door {deleted_by.display_name}`
- [ ] 4.2 Resolve `created_by` / `updated_by` user labels lazily via the existing `GET /users` cache; em-dash on failure

## 5. Edit demographics dialog

- [ ] 5.1 `<EditPatientDialog>` form: family_name, given_name, birth_date, gender (no identifier mutation in PoC — backend rejects per existing `patients-base` requirement)
- [ ] 5.2 Submit `PATCH /patients/{id}`; invalidate `[patients, id]` and `[patients, list]` query keys on success
- [ ] 5.3 Surface field-level errors (e.g. invalid gender) inline

## 6. Soft-delete action

- [ ] 6.1 Page-header kebab `Verwijderen`: destructive confirm; calls `DELETE /patients/{id}`; on success navigate back to `/_auth/patients`

## 7. i18n

- [ ] 7.1 New namespace `patient-profile` in `en/` and `nl/`

## 8. Tests

- [ ] 8.1 `<PatientProfilePage>` test: tabs render, sticky header populates from `GET /patients/{id}`
- [ ] 8.2 `<EditPatientDialog>` test: PATCH + invalidation
- [ ] 8.3 `<CareTeamSlot>` test: surfaces current teams list + placeholder copy
- [ ] 8.4 Regression: caregiver outside visibility predicate gets 404 on detail page (mirrors list visibility)

## 9. Verification

- [ ] 9.1 Orchestrator lint / typecheck / test

## 10. Docs

- [ ] 10.1 Update CHAIN tracker
- [ ] 10.2 `openspec validate patient-profile-ui --strict` clean
