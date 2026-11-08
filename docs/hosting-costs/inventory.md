# Hosting inventory — what ZAS actually runs

Source: `docker-compose.deploy.yml` (AWS demo stack) + baseline Q&A 2026-08-06.
Machine-readable twin: `data/needs.yaml`. Unknowns: `open-questions.md`.
PoC-vs-MVP component analysis (what may be swapped before MVP): `stack-choices.md`.

## Application components

| Component | Role | Scales with | Managed replacement (AWS / Azure / GCP) |
|-----------|------|-------------|------------------------------------------|
| Postgres 17 | App DB + kratos + keto + temporal + temporal_visibility | patients, retention (OQ3) | RDS / Azure DB Flexible / Cloud SQL |
| FastAPI backend | API for orchestrator + patient app | peak req/s | ECS Fargate / Container Apps / Cloud Run |
| Pathway worker | Custom-engine timers/polling/retries (same image, separate proc) | open enrollments (8k → 23k → ~110k) | ECS Fargate / Container Apps / Cloud Run |
| ~~Temporal server~~ | **Out of base (decided 2026-08-06): MVP = custom engine.** Optional add-on line only | — | Temporal Cloud (if ever) |
| Ory Kratos | Identity: patients + practitioners | identity count | Ory Network (severable option) |
| Ory Keto | Authorization tuples | patients × relations | Ory Network (severable option) |
| MinIO | Attachments: wound photos + documents | ~10 MB/pathway-patient, cumulative | S3 / Blob / GCS |
| nginx | TLS, host routing, serves orchestrator SPA | — | ALB+CloudFront / Front Door / HTTPS LB |

Patient app (`digital-front-door`): native only, distributed via app stores — no hosted web, zero hosting cost beyond backend API.

## Cross-cutting

- **HiX link**: real EHR connection in production; shape unknown (OQ1) — VPN gateway priced as optional line item.
- **Luscii**: outbound HTTPS only — egress.
- **Push notifications**: FCM/APNs via Expo — ~zero infra.
- **Email/SMS**: transactional; volume unknown (OQ4) — SES/ACS/SendGrid slot.
- **Backups**: DB (+PITR from 2030) + object storage; retention OQ3.
- **Monitoring/logging, container registry, DNS/TLS**: provider-native, always in every cell.

## Constraints

- Residency: Belgium preferred → GCP `europe-west1` (BE); else France/NL → AWS `eu-west-3`, Azure `francecentral`/`westeurope`.
- Compliance: NEN 7510 + ISO 27001 certification path.
- Tenancy: single hospital (ZAS), one prod stack; environments prod + staging (~25%) + dev/demo (minimal).
- Ops: capacity exists/planned — VM+compose shape is a serious contender, not just the cheap fallback.
