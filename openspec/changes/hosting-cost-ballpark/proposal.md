# Hosting Cost Ballpark

## Why

ZAS currently runs as a single-EC2 demo deploy (1-week ephemeral, `feat/deploy-aws`). To move beyond the demo we need a defensible ballpark of what hosting actually costs — across providers, deployment shapes, and realistic scaling tiers — before committing to an infra direction. No such calculation exists today; conversations about "what would this cost in production" are guesswork.

## What Changes

- Add a hosting cost model document set under `docs/hosting-costs/`:
  - **Infra inventory**: what ZAS actually needs to host, derived from the compose stacks (Postgres 17, Ory Kratos + Keto, MinIO/S3 object storage, Temporal + worker, FastAPI backend, orchestrator SPA + nginx/TLS, digital-front-door) plus cross-cutting needs (backups, monitoring, egress, TLS/DNS).
  - **Scaling tiers**: three named tiers with concrete numbers (pilot department / single hospital / multi-hospital), covering caregivers, active patients, request rates, storage growth, and Temporal workflow volume.
  - **Cost matrix**: per provider (AWS, Azure, GCP) × deployment shape (VM + compose vs managed services) × environment set (prod + staging + dev/demo) × scaling tier — monthly EUR ballpark with per-component breakdown.
  - **Recommendation**: which provider/shape combination fits which tier, with reasoning.
- No application code changes. This is a research + documentation change.

## Capabilities

### New Capabilities
- `hosting-cost-model`: defines what the cost model must cover — infra inventory completeness, scaling tier definitions, provider/shape/environment matrix dimensions, pricing sourcing rules (list prices, dated, linked), and the recommendation format.

### Modified Capabilities

_None — no existing runtime capability changes._

## Impact

- New docs under `docs/hosting-costs/`.
- No changes to `apps/*`, `infra/*`, or CI.
- Inputs read from: `docker-compose.yml`, `docker-compose.deploy.yml`, `infra/cdk/*` (current AWS demo shape as baseline).
- Output feeds future infra decisions (successor to the ephemeral demo deploy).
