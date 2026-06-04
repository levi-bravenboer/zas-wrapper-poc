"""Access-entitlement enums (`access-entitlements` change).

`ItemCategory` and `ShieldingAudience` drive the shielding policy service
(REQ-FUN-161): release rules are keyed by (carepath, category, audience) with
default-deny. `ConsentStatus` backs the minimal consent record gating external
grants (REQ-FUN-1/42) — the full informed-consent flow stays BL-017.

External professional types reuse `PractitionerRoleCode` (FHIR-aligned);
no separate enum.
"""

from __future__ import annotations

from enum import StrEnum


class ItemCategory(StrEnum):
    """Shieldable item categories inside patient-scoped payloads."""

    QUESTIONNAIRE_ANSWERS = "questionnaire_answers"
    DIARY = "diary"
    ATTACHMENTS = "attachments"
    PARAMETERS = "parameters"
    DOCUMENTS = "documents"


class ShieldingAudience(StrEnum):
    """Limited-sight audiences a category can be released to.

    Subjects holding `view_shielded` (care team, org chain, break-glass)
    never pass through the policy service — full sight by construction.
    """

    REPRESENTATIVE = "representative"
    EXTERNAL_PROFESSIONAL = "external_professional"
    PATIENT_OTHER_ROLE = "patient_other_role"


class ConsentStatus(StrEnum):
    ACTIVE = "active"
    REVOKED = "revoked"
