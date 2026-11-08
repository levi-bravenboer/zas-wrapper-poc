# Design — Hosting Cost Ballpark

## Context

ZAS today: dev compose stack (`docker-compose.yml`) and a single-EC2 demo deploy (`docker-compose.deploy.yml` + `infra/cdk`). Services: Postgres 17 (app + kratos + keto + temporal databases), Ory Kratos, Ory Keto, MinIO, Temporal + pathway worker, FastAPI backend, orchestrator SPA behind nginx (Let's Encrypt TLS). `digital-front-door` (patient-facing) is served as a static/mobile client — no extra server component beyond the backend.

There is no cost picture beyond "one t3.x EC2 instance". Decisions about a real deployment need a ballpark across providers and shapes.

## Goals / Non-Goals

**Goals:**
- One document set that answers: "what does hosting ZAS cost per month at tier X, on provider Y, in shape Z?"
- Comparable numbers: same inventory, same tiers, same assumptions across all providers.
- Reproducible: every price traceable to a dated list-price source.

**Non-Goals:**
- No infra code, no CDK/Terraform changes, no CI.
- No procurement-grade quotes or negotiated/committed-use discounts (noted only as sensitivity).
- No compliance certification work (NEN 7510 / ISO 27001) — residency constraints are inputs, audits are out of scope.
- No people/ops-hours costing — infra spend only, ops burden noted qualitatively.

## Decisions

### D1: Document layout — `docs/hosting-costs/`
```
docs/hosting-costs/
  README.md              # generated summary matrix + recommendation
  inventory.md           # what we host (component list + cross-cutting needs)
  tiers.md               # scaling tier narrative + derived sizing rationale
  aws.md / azure.md / gcp.md   # per-provider service choices + notes
  data/
    needs.yaml           # THE needs format: components + scaling numbers (Levi-supplied)
    prices.aws.yaml      # dated list prices per priced unit
    prices.azure.yaml
    prices.gcp.yaml
  calc.py                # stdlib-only calculator: needs × prices → monthly/yearly matrix
```
One data file per provider keeps price updates local; README matrix is calculator output pasted/generated, so it never drifts from the data. Alternative (hand-maintained tables in a mega-doc) rejected: unreadable at 3 providers × 2 shapes × 3 tiers and numbers drift.

### D1b: Three-phase workflow
1. **Needs capture** — define the `needs.yaml` format, fill component inventory from the compose stack, Levi supplies scaling numbers per tier. No provider talk yet.
2. **Provider selection** — per provider × shape, decide which concrete service fulfils each need (RDS vs VM-postgres, Fargate vs EC2, …), recorded in the provider docs.
3. **Cost calculation** — fill `prices.*.yaml` with dated list prices, `calc.py` multiplies needs × prices into monthly and yearly figures per matrix cell.
Each phase gates the next; a needs change re-runs cleanly through the calculator.

### D2: Scaling tiers — projection years from the product table (captured 2026-08-06)
Tiers are the product projection years, not abstract sizes: **t2027 (MVP production), t2030 (full production), t2036 (scaled)**. Given numbers (MAU 55k/80k/155k, pathway patients 20k/60k/250k per year, long/short pathway split, pathway count 4/>15/>50) live in `data/needs.yaml` under `given`; load figures I derived from them (req/s, DB/storage size, concurrent workflows, egress) live under `derived` with `confirmed: false` until signed off. Dominant scaler: long-term pathways are chronic/multi-year, so open Temporal workflows accumulate (~7k → ~40k → ~220k) — Temporal sizing is the standout cost driver at t2036 (OQ7).

Unknowns that block confirmation are tracked in `docs/hosting-costs/open-questions.md` (OQ1-OQ7: HiX connectivity, DR/RTO-RPO, retention, email/SMS volume, caregiver counts, availability numbers, pathway duration); each has a stated interim assumption so pricing can proceed.

### D3: Deployment shapes — two per provider
- **Shape A — VM + compose**: current stack lifted onto sized VM(s). Single VM for T1; split VMs (app / db) plus provider snapshots+backups for T2/T3. Everything self-managed, incl. Postgres, MinIO, Temporal, Ory.
- **Shape B — managed**: managed Postgres (RDS / Azure Database / Cloud SQL), provider object storage replaces MinIO (S3 / Blob / GCS), containers on managed runtime (ECS Fargate / Container Apps / Cloud Run), managed LB + certs. Temporal and Ory stay self-hosted containers in the base numbers; **Temporal Cloud** and **Ory Network** priced as separate optional line items (their pricing models — per-action / per-MAU — don't map cleanly to tiers, so keep them visible but severable).

### D4: Regions and residency — Belgium preferred, else France/NL
Residency preference order: Belgium > France ≈ Netherlands (EU always hard constraint). GCP is the only big-3 with a Belgian region: `europe-west1` (St. Ghislain) — priced as GCP's region. AWS has no BE region → `eu-west-3` (Paris). Azure → `francecentral`, fallback `westeurope` (NL). NEN 7510 + ISO 27001 certification path required; all three providers support it — documented per provider, minor cost impact.

### D5: Pricing rules
- Public list prices, on-demand, EUR (convert USD at a stated dated rate).
- Every figure carries a source link + retrieval date.
- Ballpark tolerance: ±30%. No committed-use/reserved discounts in the base number; one sensitivity row shows "with 1-yr commitment" per provider.
- Cross-cutting costs always included: backups, monitoring/logging (provider-native), egress, DNS/TLS, container registry.

### D6: Environments — 3, fixed ratios
Prod sized at tier; staging at ~25% of prod (smallest viable managed SKUs / one small VM); dev/demo = current demo shape (one small VM, always-on). Total = sum. Ratio stated once in `tiers.md` so the matrix stays simple.

## Risks / Trade-offs

- [Prices drift] → every number date-stamped + sourced; README states refresh procedure.
- [Egress/workflow volume are guesses] → assumptions isolated in `tiers.md`; matrix formulas reference them so one edit re-derives.
- [Temporal Cloud / Ory Network pricing models don't fit tier axes] → severable line items, not baked into base matrix.
- [Ballpark read as quote] → ±30% banner on README; explicitly "list price, no discounts".
- [Tier numbers wrong] → first task is user sign-off on D2 before any pricing work.

## Open Questions

Tracked in `docs/hosting-costs/open-questions.md` (OQ1-OQ7) with interim assumptions so pricing isn't blocked: HiX connectivity shape (VPN vs mediated API), DR RTO/RPO per tier, data retention (record-of-truth question), email/SMS volume, caregiver counts per year, availability numbers per tier, long-term pathway duration distribution. Levi answers these with the right people; answers land in `needs.yaml` and the calculator re-runs.
