# PoC stack choices that shape hosting cost

The PoC stack is not the MVP contract. Each component below is a choice that
changes the service list (and thus the cost matrix) if swapped. Ordered by
hosting impact.

## 1. Temporal — biggest swing — **DECIDED 2026-08-06: MVP builds a custom engine, Temporal out of base**

Base matrix excludes Temporal server + its 2 DBs. A generic background worker stays
(custom engine still needs a timer/poller process). Temporal priced as optional
add-on line only. Trade-off accepted: custom engine re-implements retries/timers/
idempotency — engineering risk noted, hosting simplified.

**Now:** Temporal server + separate worker + 2 extra Postgres DBs; sizing driven
by concurrent open workflows (8k → 23k → 110k). Self-hosted cluster at 2036 scale
is real ops; Temporal Cloud is a real bill (per-action pricing).

**Already severable in code:** the backend has `BACKEND_PATHWAY_RUNTIME_ENGINE=sync`
— an inline engine that runs pathways without Temporal at all. The abstraction
exists today.

**MVP options:**
- Keep Temporal (durable timers/retries are genuinely fitting for multi-month pathways)
- DB-driven scheduler (Postgres state + polling/pg_cron) behind the same engine
  interface → drops Temporal server + worker + 2 DBs from every matrix cell
- Provider-native workflows (Step Functions / Durable Functions) → lock-in, breaks
  the 3-provider comparison

**Cost model consequence:** price Temporal as its own line item everywhere so the
"no-Temporal MVP" total is one subtraction.

## 2. Ory Kratos + Keto — **DECIDED 2026-08-06: MVP rebuild uses Keycloak + app-level RBAC**

One identity container (Keycloak, JVM ~2-4 GB) instead of two Ory services; Keto's
relation-tuple authz collapses into backend RBAC. eHealth OIDC federated via
Keycloak's broker. Per-MAU managed IdPs (Ory Network, Cognito, Entra External ID)
rejected: recurring per-MAU bill at 55k-155k MAU + provider lock-in.

Original analysis kept below for the record.

**Now:** two extra services + 2 Postgres DBs. Self-hosted = cheap (small containers).

**Trap:** Ory Network (managed) prices per MAU — at 55k–155k MAU that's a serious
recurring bill, likely > the rest of the stack combined. Managed-identity is NOT
a cheap simplification here.

**MVP constraint:** whatever identity solution is chosen must federate Belgian
eHealth OIDC as upstream IdP (OQ8).

**MVP options:** keep self-hosted Ory (cheap, EU-neutral) · Keycloak (one service
instead of two, same cost shape) · provider IdP (Cognito/Entra External ID —
per-MAU again but cheaper tiers, and lock-in). Keto's relationship-based authz
could collapse into app-level RBAC for a single hospital — removes one service.

## 3. MinIO — **DECIDED 2026-08-06: native object storage (S3/Blob/GCS) in both shapes**

MinIO becomes dev-only. Production always uses the provider's object storage —
durability + versioning + lifecycle for pennies, one less stateful service on the
VM. MVP rebuild includes a thin storage-client abstraction, so Azure Blob is
first-class (the S3-compat caveat below is historical).

Original analysis kept below for the record.

**Now:** MinIO container, S3 API, `boto3` client in the backend.

**MVP:** on AWS/GCP swap to native object storage (S3 / GCS interop) with zero code
change — boto3 speaks to both. **Azure Blob is not S3-compatible**: shape B on
Azure needs either a storage-client abstraction in the backend or keeping MinIO
on a VM in front of Azure disks. Real line in the Azure column, not a footnote.

## 4. SSE (sse-starlette) — constrains LB/serverless choices

Backend streams server-sent events → long-lived HTTP connections. Consequences:
- LB idle timeouts must be raised (ALB/App Gateway/Front Door config)
- Serverless containers must run always-allocated (Cloud Run CPU-always-on,
  Container Apps min-replicas ≥ 1) — the scale-to-zero discount never applies
- Session affinity may be needed with >1 backend replica

Already assumed always-on in sizing; this is the reason why.

## 5. Non-issues (portable, no hosting influence)

- **FastAPI backend / SQLAlchemy / asyncpg** — container, runs anywhere
- **Orchestrator SPA** (Vite/React/Tailwind) — static files, nginx or CDN, cheap everywhere
- **digital-front-door** (Expo, native-only) — app stores; EAS build + Expo push are
  vendor line items outside infra (small)
- **No Redis, no Celery, no search engine, no message broker** in the PoC — nothing
  hidden waiting to appear in the bill. If MVP adds caching/queues, matrix gains a row.
- **`fhirclient`** in orchestrator — SMART-on-FHIR client for the HiX path; affects
  integration architecture (OQ1), not hosting cost.

## Cost-model rule derived from this

Structure `calc.py` line items so the three swappable components (Temporal, Ory,
MinIO) are individually toggleable — the MVP-variant total must be computable
without re-pricing.
