"""Identifier system URIs.

FHIR `Identifier.system` is a URI that names the issuing authority for a
given identifier value. Two patients can share the same `value` as long as
the `system` differs (e.g. an NHS number and a Belgian INSZ can collide
numerically but mean different things). Centralising the URIs here keeps
the values consistent across the ORM column, Pydantic validators, search
filters, and seed scripts.

Add new systems here when integrating with a new identity registry. The
column itself is plain `varchar`, so unrecognised systems pass through
unchecked at the database layer.
"""

from __future__ import annotations

# Belgian INSZ ("Identificatienummer van de Sociale Zekerheid", a.k.a.
# Rijksregisternummer / National Number). 11-digit number with a Mod-97
# checksum on the leading 9 digits. The OID is the FHIR-registered URI for
# the Belgian eHealth INSZ namespace.
INSZ_SYSTEM = "urn:oid:2.16.840.1.113883.2.8.4.1.1"

# Reserved for the HiX adapter (MVP scope — adapter raises NotImplementedError
# in patients-base; the constants are committed now so downstream code does
# not branch on whether the URI exists yet).
HIX_MRN_SYSTEM = "urn:zas:hix:mrn"  # MVP — placeholder URI, finalise with HiX
HIX_FHIR_PATIENT_SYSTEM = "urn:zas:hix:fhir:Patient"  # MVP — placeholder URI

# Luscii patient UUID (luscii-patient-enrichment). Unlike other systems this
# one is unique ACROSS patients (partial unique index) and writable only via
# the dedicated link endpoints — POST /patients and PATCH reject it.
LUSCII_PATIENT_SYSTEM = "urn:zas:luscii:patient"
