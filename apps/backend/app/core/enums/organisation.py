"""Organisation-domain enums.

FHIR-aligned. `Organization.type` is a `CodeableConcept` with an *extensible*
binding to the `organization-type` value set
(`http://terminology.hl7.org/CodeSystem/organization-type`). We persist the
column as a plain varchar so unknown codes pass through unchecked, and we
keep the standard codes here as a soft typing aid for seed / schemas / FE.
"""

from __future__ import annotations

from enum import StrEnum


class OrganisationTypeCode(StrEnum):
    PROVIDER = "prov"
    DEPARTMENT = "dept"
    TEAM = "team"
    GOVERNMENT = "govt"
    INSURANCE = "ins"
    PAYER = "pay"
    EDUCATIONAL = "edu"
    RELIGIOUS = "reli"
    CLINICAL_RESEARCH = "crs"
    COMMUNITY_GROUP = "cg"
    BUSINESS = "bus"
    OTHER = "other"


ORGANISATION_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/organization-type"
