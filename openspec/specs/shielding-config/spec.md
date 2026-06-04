# shielding-config Specification

## Purpose
TBD - created by archiving change access-entitlements. Update Purpose after archive.
## Requirements
### Requirement: Shielding is configurable per carepath, item category and audience with default-deny
The platform SHALL store shielding release rules (`shielding_rules`: optional carepath, item category ∈ {questionnaire_answers, diary, attachments, parameters, documents}, audience ∈ {representative, external_professional, patient_other_role}, released flag) and evaluate them through a single policy service `shielding.is_released(category, audience, carepath)`. **Absence of a matching rule MUST mean shielded** (default-deny: data is shielded unless explicitly released to an audience). Carepath-specific rules SHALL override global rules. Rules SHALL be manageable by admins and changes SHALL be audit-attributed. (REQ-FUN-161)

#### Scenario: Default-deny without a rule
- **WHEN** no release rule exists for diary entries vis-à-vis external professionals on carepath C
- **THEN** an external professional's response payloads for C exclude diary content

#### Scenario: Carepath rule overrides global
- **WHEN** a global rule releases parameters to external professionals but carepath C carries a rule withholding them
- **THEN** parameters are shielded on C and released elsewhere

### Requirement: Shielding enforcement has one wiring point and clear division of labour
Keto SHALL keep answering the subject-level question (two tiers: `view_shielded` vs `view`); the shielding policy service SHALL answer the response-shape question (which item categories appear). Response serialization for patient-scoped payloads SHALL pass through the policy service — routes MUST NOT hand-roll shielding decisions. Subjects holding `view_shielded` (care team, org chain, break-glass) SHALL see all categories regardless of release rules. (REQ-FUN-161)

#### Scenario: Internal full sight unaffected by rules
- **WHEN** a care-team member requests a patient's data on any carepath
- **THEN** all item categories are present regardless of release rules

#### Scenario: Limited-sight subject gets filtered shape
- **WHEN** a subject holding only `view` (not `view_shielded`) requests patient data
- **THEN** only categories released to their audience are present and the omission is structural (no shielded values serialized)

### Requirement: Patients can shield own items from specific audiences
The platform SHALL support patient-initiated shielding at the model level: `shielded_items` rows (patient, item reference, audience) that withhold a specific item from an audience regardless of release rules. (Authoring UI is out of scope for this change.) (REQ-FUN-161)

#### Scenario: Patient-marked item is withheld
- **WHEN** a patient marks a questionnaire answer as private vis-à-vis representatives and a representative requests the data
- **THEN** that answer is absent even if the category is released to representatives

