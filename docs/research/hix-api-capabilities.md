# HiX API Capabilities

ChipSoft HiX = EHR/EPD used by ZAS (Ziekenhuis aan de Stroom) and most NL/BE hospitals.

## Access Methods

- **HL7v2** — ADT, ORM, ORU, SIU, MDM messages
- **FHIR** — RESTful, newer, resource-based
- **CS-Webservices / HiX Integration Platform** — proprietary SOAP/REST

All writes require ChipSoft partner agreement + hospital sign-off. No public API. Sandbox available via ChipSoft.

---

## Patient Visits / Appointments

### Can
- Create appointment → HL7 `SIU^S12` / FHIR `Appointment` POST
- Reschedule → `SIU^S13` / FHIR PUT
- Cancel → `SIU^S15` / FHIR status=cancelled
- Register patient (`ADT^A04`) — outpatient visit
- Admit / discharge / transfer → `ADT^A01` / `A03` / `A02`
- Read slots → FHIR `Slot` GET (if exposed)
- Notify external system → outbound SIU feed

### Can't (typically)
- Bypass scheduling rules (resource/agenda config stays in HiX)
- Create new agenda / resource types via API
- Override double-bookings without flag
- Direct DB write — not allowed

---

## Internal Tasks / Workflow Items

HiX modules vary by license + version.

### Possible (with custom interface + ChipSoft)
- **Orders module** (`ORM^O01`) — lab / radiology / medication orders
- **Results** (`ORU^R01`) — push results into patient record
- **Documents / correspondence** (`MDM^T02`) — push PDF/letters to dossier
- **Notifications / Berichten** — limited push via integration platform

### Not possible / hospital-specific only
- **Werklijst / worklist tasks** — internal HiX workflow, no standard external write
- **Zorgplan / care plan tasks** — module-internal, FHIR `Task` partial support only
- **Helpdesk / incident tickets** — not in HiX scope
- **User-to-user messages** (CS-Berichten) — internal, no API
- **Decision support flags / popups** — config side, not data API

---

## Notes

Final scope = depends on:
- HiX version
- Licensed modules at hospital
- ChipSoft contract terms

For ZAS specifics: contact ChipSoft account manager for integration spec sheet.
