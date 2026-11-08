# Post-MVP inventory — from Scope v5, "Nice to have after MVP" column

Source: context/new/Added 2026-08-18/ZAS platform development scope, roadmap and resourcing.xlsx


## Luscii Care Pathway Builder and Patient Monitoring, Clinical Engine

### Care Pathway Builder
- **Building-block library** — ZAS-specific custom blocks; advanced gating patterns  _[Luscii]_
- **Clinical-task authoring UI for ZAS clinicians** — Role-based authoring; co-author flows; review/approval workflow  _[Luscii]_
- **Pathway versioning + publish workflow** — Approval routing per erkenning; pre-publish clinical validation gates  _[Luscii]_
- **Pathway preview / dry-run on synthetic patient** — Auto-generated regression preview when a published module changes  _[Luscii]_
- **Pathway audit trail** — Audit search / filter / export  _[Luscii]_
- **MVP zorgtraject pathway templates** — BAU pathways (3 new pathways/year per Bestek volume table)  _[Joint (R+L)]_

### Clinical Engine
- **Threshold + rule evaluation** — Per-erkenning threshold variants; advanced cohort rules  _[Luscii]_
- **Signal / alert generation to clinicians** — Smart de-duplication; cross-pathway alert aggregation  _[Luscii]_
- **Trend detection** — ML-assisted trend detection (post AI Act review)  _[Luscii]_
- **Engine versioning + release process** — Per-customer engine version pinning  _[Luscii]_

### Device Connectivity
- **Bluetooth LE intake** — Multi-vendor parity across Belgian device market  _[Luscii]_
- **FHIR / REST device adapters** — Open SDK for ZAS-procured devices  _[Luscii]_
- **Holter device intake** — Multi-vendor Holter, automated triage assist  _[Joint (R+L)]_
- **Device pairing + provisioning UX** — Pharmacy-assisted pairing; kit logistics  _[Luscii]_

### Questionnaires & PROMs / PREMs
- **Questionnaire authoring** — Conditional question branching; advanced scoring (sub-scales)  _[Luscii]_
- **Scheduling per pathway phase + recurrence** — Adaptive scheduling driven by clinical engine signals  _[Luscii]_
- **Scoring + thresholding** — ML scoring (post AI Act review)  _[Luscii]_
- **FHIR-conformant storage of answers with context** — Long-term archival; multi-tenancy across erkenningen  _[Luscii]_

### Patient web app + mobile SDK
- **Device pairing UX** — Step-by-step accessibility improvements (WCAG)  _[Luscii]_
- **Questionnaire screens** — Voice-input; offline mode  _[Luscii]_
- **Reminders + dagboek** — AI-summarised diary entries (post AI Act review)  _[Luscii]_
- **Content delivery / information cards** — Personalised content (preferences, health literacy)  _[Luscii]_
- **Multilingual UI of Luscii-rendered screens** — Additional languages on ZAS request  _[Luscii]_

### Clinician + external-pro apps
- **Patient list / cohort view** — Custom cohort definitions, saved filters  _[Luscii]_
- **Pathway state view per patient** — Timeline visualisation, predictive next-step view  _[Luscii]_
- **Signal triage UX** — Skill-based routing; cross-disciplinary triage  _[Luscii]_
- **External-professional access portal** — Portal extensions for pharmacies, paramedics  _[Joint (R+L)]_

### Chat, Video, IC, Dagboek, Content
- **Asynchronous secure messaging** — Translation assist; clinical AI summarisation (post AI Act)  _[Joint (R+L)]_
- **Video consultation** — Group video; recording with consent + retention policy  _[Luscii]_
- **Informed consent** — Re-consent flows; version-aware IC  _[Reaktor]_
- **Dagboek** — AI-summarised diary (post AI Act review)  _[Luscii]_
- **Information content delivery** — Personalised content engine  _[Luscii]_

### Medication management
- **MDR Class IIa technical file** — Continuous PMS, audits  _[Luscii]_
- **Risk management + change control** — Annual risk-review cycle with ZAS clinical leads  _[Luscii]_
- **Post-market surveillance** — Real-world evidence pipeline  _[Luscii]_
- **AI governance for clinical AI** — ML model monitoring + drift detection  _[Luscii]_

## Digital Front Door

### Mobile app shell + platform
- **iOS + Android app shell** — Tablet-optimised builds; Apple Watch / Wear OS companions  _[Reaktor]_
- **App distribution + ZAS-branded build** — Multi-erkenning branded variants if ZAS requires  _[Reaktor]_
- **Authentication flow** — Biometric local re-auth; passkey-based  _[Reaktor]_
- **Multilingual UI of Reaktor screens** — ZAS-driven release calendar; staged rollout  _[Reaktor]_

### CarePaths display
- **Patient view of composed pathway** — Predictive next-step UX; gamified milestones  _[Reaktor]_
- **Treatment / recovery / preparation information cards** — Patient-personalised content (preferences, literacy)  _[Reaktor]_
- **Multi-pathway support** — Cross-pathway prioritisation; AI-suggested ordering  _[Reaktor]_

### Chat with clinicians
- **Async secure messaging UX** — Group chat; large file attachments  _[Reaktor]_
- **Push notifications + offline support** — Smart-channel selection; quiet-hours respect  _[Reaktor]_

### Patient self-booking
- **Available slot view** — Multi-resource slot composition; preference learning  _[Joint (R+N)]_
- **Booking create / change / cancel UX** — Wait-list booking; recurring bookings  _[Reaktor]_
- **HiX slot writeback** — Complex appointment types; multi-resource bookings  _[Joint (R+N)]_

### Plans for Patients
- **Exercise plan viewer** — AR-guided exercises; wearable-assisted form check  _[Reaktor]_
- **Adherence logging + progress visualisation** — ML-suggested plan adjustments (post AI Act review)  _[Reaktor]_
- **Plan content authoring** — Templated plan libraries per zorgtraject  _[Reaktor]_

### Video calls
- **Video consult initiation + join UX** — Group video for multi-disciplinary consults  _[Reaktor]_
- **Multi-party video** — Adaptive bitrate; cross-network resilience  _[Reaktor]_
- **Recording + retention with consent** — Auto-transcription; AI-Act-gated clinical-note generation  _[Reaktor]_

### Reaktor questionnaires
- **Questionnaire rendering + submission UX** — Branching surveys; adaptive question selection  _[Reaktor]_
- **Scheduling integration with Orchestrator** — Adaptive scheduling tied to engagement signals  _[Reaktor]_
- **Response handling for admin / non-clinical questionnaires** — Standardised exports to BI; cross-survey correlation  _[Reaktor]_

### Patient web portal
- **Luscii questionnaire screens SDK wrapper** — Offline PROM capture; PROM-result sharing across pathways  _[Joint (R+L)]_
- **Luscii content delivery SDK wrapper** — Cross-source content prioritisation  _[Joint (R+L)]_
- **SDK version-binding contract with Luscii** — Automated compatibility testing; canary SDK rollouts  _[Joint (R+L)]_

## Reaktor Care Pathway Builder

### Builder UI for ZAS admin staff
- **Step authoring** — Custom step types per zorgtraject; marketplace of steps  _[Reaktor]_
- **Reference to Luscii pathway module by version** — Bulk re-bind; scheduled migrations; A/B versions  _[Joint (R+L)]_
- **Eligibility filter authoring** — ML-suggested cohorts (post AI Act review)  _[Reaktor]_
- **Branching on admin events** — Advanced multi-arm branching  _[Reaktor]_
- **Template library per MVP zorgtraject** — BAU templates (3 new pathways/year per Bestek volumes)  _[Reaktor]_
- **Composer test / preview against synthetic patient** — Regression preview between bound Luscii module versions  _[Reaktor]_

### Version binding to Luscii Builder
- **List of Luscii published module versions** — Filter / search / tagging  _[Joint (R+L)]_
- **Version diff view** — Clinical-impact annotated diff  _[Joint (R+L)]_
- **Migration workflow** — Scheduled migrations; staged rollout (canary)  _[Reaktor]_
- **Frozen-version policy enforcement** — Per-pathway policy variants  _[Joint (R+L)]_

### Information-provision authoring
- **Patient letter / message template editor** — AI-assisted drafting (post AI Act review)  _[Reaktor]_
- **Multi-channel content** — WhatsApp / RCS where ZAS allows  _[Reaktor]_
- **Multilingual content** — Translation memory; ZAS-approved phrasing per zorgtraject  _[Reaktor]_
- **Template versioning + approval** — Approval delegation; bulk approvals  _[Reaktor]_

### Admin-side audit + publish
- **Composer change log** — Long-term archival; cross-system trace correlation  _[Joint (R+L)]_
- **Publish workflow with approvals** — Conditional approvals per pathway/risk class  _[Reaktor]_

## Reaktor Care Pathway Platform

### Runtime engine
- **Patient-on-path tracking + state machine** — Cross-pathway state aggregation; multi-pathway patient view  _[Reaktor]_
- **Idempotent step execution + retry / backoff** — Circuit-breaker patterns; adaptive backoff  _[Reaktor]_
- **Per-active-pathway metering** — Per-erkenning metering; cost-attribution dashboards  _[Reaktor]_

### Scheduler + triggers
- **Time-based triggers** — Time-zone / quiet-hours-aware (ties into notification orchestration)  _[Reaktor]_
- **Calendar / appointment event triggers** — Multi-erkenning calendar federation  _[Reaktor]_
- **External event triggers** — Streaming subscription / FHIR Subscriptions R5  _[Reaktor]_
- **Wait-for-condition triggers** — Event-driven (push) condition triggers  _[Reaktor]_

### Action executor
- **Invoke Luscii pathway module via API** — Asynchronous invocation patterns; bulk operations  _[Joint (R+L)]_
- **Send notification** — Delivery-tracking + receipts; preferred-channel ML  _[Reaktor]_
- **Create / update HiX booking via Newwave Gateway** — Multi-resource bookings; complex appointment types  _[Joint (R+N)]_
- **Trigger e-signing flow** — Bulk signing; advanced eIDAS levels  _[Reaktor]_
- **Call MCP tool** — Multi-agent orchestration; tool marketplaces  _[Reaktor]_

### Identity broker
- **Entra ID / Azure AD SSO for ZAS staff** — Conditional Access policies; PIM-based privileged access; service principals for non-human callers  _[Reaktor]_
- **eHealth integration** — Federated identity across hospital groups  _[Reaktor]_
- **itsme integration** — itsme-based signing flows  _[Reaktor]_
- **eID integration** — eID-based document signing (eIDAS qualified)  _[Reaktor]_
- **CSAM mandatenbeheer** — Bulk mandate handling; cross-erkenning mandates  _[Reaktor]_
- **SMART-on-FHIR launch handler** — Multi-context launch; embedded launch in HiX UI  _[Joint (R+N)]_
- **SSO across erkenningen** — External partner SSO federations  _[Joint (R+L)]_

### Access Management Engine
- **PDP service** — Multi-region PDP; offline-capable decision caching  _[Reaktor]_
- **Entitlement model** — Attribute-based policies; ML-suggested entitlements  _[Reaktor]_
- **Group / claim → platform role mapping** — Automatic discovery of new AD groups; role-mining tools  _[Reaktor]_
- **Per-service permission surfaces** — Per-plugin permission catalogues (Bestek IV.1.4)  _[Reaktor]_
- **Per-pathway scoping** — Cross-pathway viewing roles; oversight roles  _[Reaktor]_
- **Per-erkenning scoping** — Cross-erkenning oversight roles  _[Reaktor]_
- **Time-bounded transmural episode entitlements** — Auto-expiry + auto-renewal; partner-organisation portals  _[Reaktor]_
- **CSAM mandatenbeheer enforcement on every request** — Bulk mandate sync; cross-erkenning mandates  _[Reaktor]_
- **AI / MCP authorization: consent capture + tool data-category gating + per-action approval** — Delegated approvals; auto-approval policies; AI tool marketplace gating  _[Reaktor]_
- **Access management admin UI for ZAS** — Bulk operations; impact preview; what-if simulator  _[Joint (R+L)]_
- **Entitlement-change audit + approval workflow** — Risk-graded approval policies; auto-roll-forward to ZAS GRC  _[Reaktor]_

### Notification Subsystem
- **Channel preference per patient** — Smart-defaults; preference learning  _[Reaktor]_
- **Quiet hours + language defaults** — Per-zorgtraject language defaults  _[Reaktor]_
- **Fallback chains** — Adaptive fallback based on delivery feedback  _[Reaktor]_
- **Restart-and-notify external care professionals** — Cross-organisation notify, including primary care + home care  _[Reaktor]_

### Transmural sharing & integrations
- **e-Refferal** — Bi-directional referrals; closed-loop tracking  _[Reaktor]_
- **CoZo integration** — CoZo write-back of pathway outcomes  _[Reaktor]_
- **Vaccinet integration** — Bi-directional vaccination tracking  _[Reaktor]_
- **SumEHR awareness** — SumEHR contribution by ZAS where allowed  _[Reaktor]_
- **External-professional notification** — Belgian-association directory integration  _[Reaktor]_

### Tolk
- **Booking workflow** — Tolk vendor competition; SLA monitoring  _[Reaktor]_

### MCP Server / AI Integration Layer
- **MCP tool definitions** — Tool marketplace; partner-contributed tools  _[Reaktor]_
- **Auth + audit per tool invocation** — Fine-grained per-action audit  _[Reaktor]_
- **Version negotiation with ZAS Clinical Intelligence Layer** — Automated migration between MCP versions  _[Reaktor]_
- **Quarterly MCP version roadmap** — Roadmap reviewed twice a year with ZAS  _[Reaktor]_

### Document signing service
- **Belgian eIDAS-compliant signing** — Qualified electronic signature (QES) where ZAS requires  _[Reaktor]_
- **Signed-document storage + retrieval** — Cross-system retrieval via FHIR DocumentReference  _[Reaktor]_

### Invoicing, billing & payments
- **Tarification** — Auto-update of nomenclatuur when RIZIV changes  _[Reaktor]_
- **Invoice generation** — Invoice consolidation; multi-payer  _[Reaktor]_
- **PSP / payment integration** — Refund flows; recurring payments  _[Reaktor]_
- **Patient self-pay flow** — Subscription / package payments  _[Reaktor]_

### Orchestrator audit + replay
- **Audit log per trigger and action** — Searchable + exportable; cross-system trace correlation  _[Reaktor]_
- **Replay capability for incident investigation** — Time-travel debugging; what-if replay  _[Reaktor]_

### Informed Consent
- **IC template authoring** — Version-controlled IC libraries; mandatory re-consent on material change  _[Reaktor]_
- **IC presentation + capture in patient app** — Multi-step IC with conditional sections; voice playback  _[Reaktor]_
- **IC capture for caregivers acting on behalf** — Multi-mandate IC chains  _[Reaktor]_
- **IC version + re-consent flow** — Auto-detect material changes triggering re-consent  _[Reaktor]_
- **IC integration with Belgian eIDAS signing** — Qualified electronic signature (QES) for high-risk IC  _[Reaktor]_
- **IC audit log + retention** — Long-term archival to ZAS GRC  _[Reaktor]_
- **IC withdrawal + downstream propagation** — Granular per-purpose withdrawal  _[Reaktor]_

### Documentbeheer
- **Document upload UX** — Bulk upload; OCR pre-processing  _[Reaktor]_
- **Document storage** — Versioning; immutable archival  _[Reaktor]_
- **Document categorisation + retention policy** — AI-assisted categorisation (post AI Act review)  _[Reaktor]_
- **Document access control** — Time-bounded sharing links  _[Reaktor]_
- **Document writeback to HiX** — Multi-document types; structured report writeback  _[Joint (R+N)]_
- **Document audit log** — SIEM integration  _[Reaktor]_
- **Bulk document operations + search** — Full-text + semantic search  _[Reaktor]_

### MDO
- **MDO meeting setup + scheduling** — Recurring MDOs with auto-attendee selection  _[Reaktor]_
- **Shared MDO patient list + agenda** — Predictive patient suggestion based on signals  _[Reaktor]_
- **In-session decision capture during MDO** — AI-assisted summarisation (post AI Act review)  _[Reaktor]_
- **MDO outcome documentation + dissemination** — Auto-routing of outcomes to patient app where relevant  _[Reaktor]_
- **MDO follow-up task creation** — ML-suggested follow-ups; auto-prioritisation  _[Reaktor]_
- **Cross-clinician coordination view** — Real-time presence + chat  _[Joint (R+L+N)]_

### Patient enrollment
- **Patient onboarding flow into care pathway** — Bulk enrollment; cohort enrollment  _[Joint (R+N)]_
- **Order form integration with HiX** — Conditional fields; multi-step orders  _[Joint (R+N)]_
- **Patient invitation** — Multi-channel invite; smart retry  _[Joint (R+N)]_
- **Enrollment audit + status tracking** — Cohort-level enrollment dashboards  _[Reaktor]_

## HiX Integration Layer

### HiX FHIR Integration Gateway
- **FHIR R4 read** — Full FHIR R4 surface; FHIR R5 readiness  _[Newwave]_
- **FHIR R4 write** — Bulk write; transactional bundles  _[Newwave]_
- **SMART-on-FHIR launch endpoint** — Multi-context launches; embedded views  _[Joint (R+N)]_
- **Idempotency keys + correlation IDs** — Cross-system correlation observability  _[Newwave]_
- **Retry / backoff policies** — Adaptive backoff; circuit breakers  _[Newwave]_

### Booking & Scheduling Sync
- **HiX event publish** — Streaming subscription; FHIR Subscriptions R5  _[Newwave]_
- **Orchestrator → HiX slot writeback** — Complex appointment types; multi-resource  _[Joint (R+N)]_

### Terminology mapping
- **SNOMED-CT mapping** — Full coverage; automated mapping updates  _[Newwave]_
- **LOINC mapping** — Full LOINC; lab result coverage  _[Newwave]_
- **Belgian Caresets** — Care-pathway-specific Caresets co-designed with ZAS  _[Newwave]_

### Document writeback
- **Holter PDF / report → HiX DocumentReference** — Multi-document types; structured report writeback  _[Newwave]_

### ChipSoft change-control liaison
- **CC-ICT_Z liaison + HiX-side change management** — Quarterly change-cycle alignment  _[Newwave]_

## Reaktor Data & Master Data Platform

### Master-data sync
- **Specialismen, afdelingen, campi, kostenplaatsen** — Bi-directional sync (write-back for ZAS-curated entities)  _[Reaktor]_
- **Erkenning-aware sync** — Cross-erkenning federation / aggregation  _[Reaktor]_
- **FHIR-where-possible APIs** — FHIR R5 readiness  _[Reaktor]_

### SHDR
- **Archetype + template governance** — ZAS-specific archetypes; clinical-modelling cycle  _[Reaktor]_
- **Composition storage** — High-availability cluster; cross-region replication  _[Reaktor]_
- **AQL queries** — Query catalogue; self-service AQL editor  _[Reaktor]_

### OMOP secondary-use feed
- **ETL pipeline FHIR → OMOP** — Near-real-time pipeline; CDM extensions  _[Reaktor]_
- **Pseudonymisation** — Key escrow; re-identification workflow  _[Reaktor]_
- **OMOP CDM** — Custom ZAS vocab; OHDSI tooling integration  _[Reaktor]_

### ICHOM exports pipeline
- **CSV / JSON / FHIR exports** — Scheduled deliveries to ICHOM registries  _[Joint (R+L)]_
- **Scheduled + on-demand modes** — Multi-destination routing  _[Reaktor]_

### Data warehouse / data lake feeds
- **DWH push** — Real-time CDC into DWH  _[Reaktor]_
- **Lake-level access** — Multi-region replicas; analytics workbench  _[Reaktor]_

### Cross-system reporting / BI layer
- **Dashboards** — Self-service BI for ZAS analysts  _[Joint (R+L)]_
- **Reporting APIs** — API rate-limiting + tenancy controls  _[Joint (R+L)]_

## Reaktor Compliance & Operations

### GDPR / DPA / DPIA
- **DPIA per zorgtraject** — DPIA refresh cycle aligned with pathway versioning  _[Reaktor]_
- **DPA + sub-processor management** — Sub-processor audit cadence; flow-down review cycle  _[Reaktor]_
- **Data residency** — Belgium-only hosting where ZAS requires  _[Reaktor]_

### Audit log aggregation
- **Consolidated audit** — SIEM integration; long-term archival to ZAS  _[Joint (R+L)]_
- **Long-term retention** — Tiered archival; defensible deletion  _[Reaktor]_

### Encryption + key management
- **At rest** — Customer-managed keys for ZAS  _[Reaktor]_
- **In transit** — Mutual-TLS across all internal hops  _[Reaktor]_
- **Key rotation policy** — Automated rotation with zero-downtime  _[Reaktor]_

### BCP / DR
- **Backup + restore** — Quarterly DR drills with ZAS  _[Reaktor]_
- **RTO / RPO targets** — Tightened targets for critical pathways  _[Reaktor]_
- **DR drill cadence** — Bi-annual drills with cross-system scope  _[Reaktor]_

### Observability
- **Centralised logging** — Long-term log retention; advanced search  _[Reaktor]_
- **Distributed tracing** — Tail-based sampling; ZAS-shared dashboards  _[Reaktor]_
- **Metrics + alerting** — SLO-based alerting; error-budget policy  _[Reaktor]_

### SLA + incident management
- **Severity-based SLAs** — Tightened SLAs for critical pathways  _[Reaktor]_
- **Major incident process** — Joint incident drill with ZAS  _[Joint (R+L+N)]_
- **24x7 support** — Belgian on-site support hours  _[Reaktor]_

### EU AI Act compliance
- **AI risk classification per use case** — Continuous AI Act change-monitoring  _[Reaktor]_
- **Transparency + human oversight controls** — Per-erkenning oversight policies  _[Reaktor]_
- **Logging + post-market monitoring** — Drift detection; bias audits  _[Reaktor]_

### Pen testing + vulnerability management
- **Periodic pen test** — Continuous attack-surface monitoring  _[Reaktor]_
- **Vulnerability management** — Zero-trust posture improvements  _[Reaktor]_

### KB Zorg op Afstand + RIZIV awareness
- **KB Zorg op Afstand conformance** — Tracking of regulatory changes during contract  _[Reaktor]_
- **RIZIV nomenclatuur tracking** — Auto-update on RIZIV publications  _[Reaktor]_
