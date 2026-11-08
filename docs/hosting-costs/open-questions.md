# Hosting — open questions

Questions Levi answers later with the right people. Each has an id referenced
from `data/needs.yaml`. Pricing proceeds with the stated interim assumption;
answers flow back into `needs.yaml` and the calculator re-runs.

| id | Question | Why it matters | Interim assumption |
|----|----------|----------------|-------------------|
| OQ1 | How does hosting reach HiX — site-to-site VPN into the hospital network, or a mediated API over the internet? **Cost delta quantified (2026-08-06):** API ≈ €0 extra (egress only); VPN gateway ≈ €33/mo (AWS/GCP) to €25-130/mo (Azure) + per-GB. Not decision-driving; connection type still needs hospital IT. | Small severable line item either way; network architecture is the real open part. | VPN priced as optional line item on every provider |
| OQ2 | ~~DR requirements per tier~~ **ANSWERED, then superseded same day (SLA memo via colleague): multi-AZ + standby DB replica + PITR from MVP; quarterly DR drills with ZAS; no cross-region standby.** | 2027 DB cost ≈ 2× vs the earlier single-AZ MVP assumption. | Multi-AZ all tiers, PITR, quarterly drill cadence |
| OQ3 | ~~Data retention: is ZAS part of the medical record?~~ **ANSWERED (2026-08-06, Levi): HiX is record of truth.** ZAS keeps operational data only; Belgian 30-yr record obligation (KB 3-5-1999 / Kwaliteitswet 30-50 yr) lives on the HiX side. | Storage plateaus; no 30-yr archive tier. Makes ZAS→HiX sync reliability load-bearing (see OQ1). | Confirmed: 5 yr online retention in ZAS, short retention for logs/messaging. Follow-up: define what must sync to HiX and purge cadence |
| OQ4 | ~~Email/SMS volume~~ **ANSWERED (2026-08-06, Levi): assumption accepted.** | — | Email ~2/patient/month; SMS none |
| OQ5 | ~~Caregiver account counts~~ **ANSWERED (2026-08-06, Levi): assumption accepted.** | — | 300 / 600 / 1200 (2027/2030/2036) |
| OQ6 | ~~Availability per tier~~ **FINAL (2026-08-06, SLA memo): 99.9% all tiers incl MVP.** Rationale: Luscii SDK (messaging/video/questionnaires) reused as-is caps us at Luscii's own 99.9%; tender row 11.2.1 non-mandatory; NIS2 needs proportionate continuity (RTO/RPO + tested plan), satisfied by 99.9 + quarterly DR drills. NIS2 flow-down note stands. | Multi-AZ from MVP is the cost consequence; video infra confirmed off our bill (Luscii-side). | 99.9% + multi-AZ + standby replica + on-call, all tiers — full rationale in `needs.yaml` `meta.sla_rationale` |
| OQ8 | ~~Belgian eHealth-platform integration~~ **ANSWERED (2026-08-06, Levi): probably connect to their OIDC instance.** Kratos gets eHealth OIDC as upstream IdP — integration work, no hosting cost line. | Architecture note for identity design; €0 infra. | Documented in needs.yaml components.kratos |
| OQ7 | ~~Long-term pathway duration~~ **ANSWERED (2026-08-06, Levi): 70% close within 1 yr, 30% run 1+ yr.** | Concurrent workflows recomputed: 8k / 23k / 110k (2027/2030/2036) — formula in `needs.yaml` `meta.pathway_durations`. | 30% tail modelled at avg 2.5 yr open |

## For the projection-table owner (sales)

Questions for the person who supplied the 2027/2030/2036 table and requested the cost calculation.

**Numbers:**
| id | Question | Why |
|----|----------|-----|
| SQ1 | MAU 55k vs 20k pathway patients/yr — who are the other ~35k? Is the app a general hospital front-door beyond pathways? | Changes backend load profile and what we're actually hosting |
| SQ2 | Definition of "monthly active user" — patients only, or caregivers/family too? | Identity counts, concurrency |
| SQ3 | 170k unique/yr vs 55k MAU implies many one-off users — what do they do? | One questionnaire vs months of monitoring = different infra |
| SQ4 | Are projections steady-state averages or year-end peaks? Seasonality? | Peak sizing vs average sizing |
| SQ5 | Long-term pathway duration — chronic/never closes? (→ OQ7) | Dominant workflow-engine cost driver |
| SQ6 | Caregiver/staff counts per projection year (→ OQ5) | Missing from table |

**Deliverable:**
| id | Question | Why |
|----|----------|-----|
| SQ7 | Purpose of the figure — internal budget, business case to hospital, provider negotiation? | Framing + precision |
| SQ8 | Is ±30% list-price ballpark acceptable, or quote-grade needed? | Scope of pricing work |
| SQ9 | Monthly, yearly, or multi-year TCO to 2036? | Output format |
| SQ10 | Infra only, or also ops personnel / licenses / support contracts? | Current model is infra-only |
| SQ11 | Is there a hosting budget target to fit inside? | Table shows story-point budget — related envelope? |
| SQ12 | Deadline + delivery format (slide / doc / spreadsheet)? | Planning |

**Commitments possibly already made:**
| id | Question | Why |
|----|----------|-----|
| SQ13 | Uptime/SLA already promised to the hospital? (→ OQ6) | Biggest single cost fork (multi-AZ or not) |
| SQ14 | Is ZAS record of truth or HiX? Retention promises? (→ OQ3) | Storage growth forever vs plateau |
| SQ15 | Provider already promised/excluded (Microsoft shop, Belgian-soil clause)? | Could collapse the 3-provider comparison |
| SQ16 | Anything agreed with ChipSoft/hospital IT about HiX connection type? (→ OQ1) | VPN line item yes/no |
