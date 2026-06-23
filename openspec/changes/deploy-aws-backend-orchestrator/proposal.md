## Why

We need to put the backend + orchestrator in front of a single reviewer for ~1 week, then tear it all down. There is no hosted environment today — the stack only runs via `docker-compose` on a developer machine. Standing up production-shaped AWS infra (Fargate + RDS + S3 + CloudFront) is the wrong tool: slow to provision, NAT/RDS cost traps, and far more than one user for one week warrants. This change provisions the **cheapest, fastest, one-command-kill** environment that runs the existing stack unchanged.

## What Changes

- **Single EC2 host runs the stack via docker-compose.** No re-architecture, no managed AWS services. Postgres, Temporal, Ory Kratos/Keto, MinIO, backend, worker, and orchestrator all run as containers on one instance (`t3.large`/`t3.xlarge`, eu-west-1 for EU data residency).
- **Custom images built locally → ECR.** Two app images — `backend` (existing Dockerfile; worker reuses it) and `orchestrator` (new Dockerfile: pnpm build → nginx + TLS) — are built on the developer CLI and pushed to ECR. Public images (postgres, kratos, keto, minio, temporal) pull from Docker Hub. The box never builds; it only pulls.
- **Compose + configs delivered via S3.** `docker-compose.deploy.yml` + ory/nginx configs are uploaded to S3 by CDK (`BucketDeployment`) during deploy; the box `aws s3 sync`s them on boot. No git clone, no source, no build toolchain, no repo creds on the box.
- **moon-driven deploy off SSO.** A moon task set (`deploy:up/down/status/stop/start/logs/ssh/url`) backed by TypeScript (execa) scripts with preflight gating + typed error handling. `deploy:up` sequences ECR stack → build/push → app stack; `deploy:down` destroys everything (typed confirm).
- **CDK (TypeScript), two stacks.** `ZasEcrStack` (ECR repos) + `ZasAppStack` (VPC default, security group, EC2 + EBS, Elastic IP, Route53 A-records, S3 config bucket, IAM role with ECR+S3 pull, user-data bootstrap).
- **HTTPS via Let's Encrypt** terminating on the box (certbot in nginx) — no ALB. Existing Route53 hosted zone `zas.lebba.nl`; two A-records `app.zas.lebba.nl` (orchestrator) + `api.zas.lebba.nl` (backend) → the one Elastic IP. nginx routes by host; SAN cert covers both names.
- **Secrets stay local, never in git or the CF template** — `deploy:up` stages the local gitignored `apps/backend/.env` into the S3 config bundle (Block Public Access + SSE-KMS, scoped read); the box syncs it and compose `env_file` consumes it unchanged. Frontend `VITE_*` are build-time, baked into the orchestrator image at build (never reach the box).
- **Temporal persists to the shared Postgres** (auto-setup, not `start-dev`) so workflow state survives restarts. **Kratos keeps `--dev`** (accepted risk on the real HTTPS domain; fallback = proper config if auth misbehaves).
- **Minimal demo seed** — reuses the existing idempotent seed modules but runs a demo subset: tenant + `admin` role (all permissions, incl. `PATIENT_ACCESS_ALL`) + a single admin user = **levi.bravenboer@reaktor.com** + the bladder-cancer pathway + Kratos identity link + Keto reconcile. Admin email/name parameterized via env (`BACKEND_BOOTSTRAP_ADMIN_EMAIL`/`_NAME`); password via `BACKEND_BOOTSTRAP_ADMIN_PASSWORD`. No demo patients/practitioners/care teams.
- **Out of scope:** patient app (`digital-front-door`), production hardening, ALB/CloudFront, autoscaling, managed backups, multi-env, CI pipeline (deploy is local CLI).

## Capabilities

### New Capabilities
- `aws-ephemeral-deploy`: a CDK-defined single-EC2 environment that runs the full backend + orchestrator stack via docker-compose (images from ECR, configs from S3), reachable over HTTPS at `app.`/`api.zas.lebba.nl`, deployed by one CLI command and removed with `cdk destroy`.

## Impact

- **New infra (CDK)**: `infra/cdk/` TypeScript CDK app, two stacks — `ZasEcrStack` (ECR repos) + `ZasAppStack` (EC2, SG, Elastic IP, Route53, S3 config bucket + BucketDeployment, IAM, user-data). Plus a moon project (`deploy:*` tasks) → TypeScript/execa scripts orchestrating build → push → deploy + lifecycle.
- **New image**: `orchestrator` Dockerfile (multi-stage: pnpm build → nginx serving `dist` + certbot TLS + host routing). Backend image reused as-is.
- **Compose**: `docker-compose.deploy.yml` referencing ECR image URIs (not `build:`) for backend/worker/orchestrator; public images unchanged. Public URLs (Kratos `serve.public.base_url`, SPA API base, CORS origins) parameterized via env → `app.`/`api.zas.lebba.nl`.
- **Config/secrets**: ory/nginx configs + the staged local `.env` shipped via the SSE-KMS S3 bucket; `localhost` and default creds replaced with deploy-time values; document the variable set in a committed `.env.deploy.example` while real `.env` stays gitignored. Temporal DB creds added to the var set.
- **No application code changes** to backend domain logic. Data is ephemeral — `cdk destroy` wipes the EBS volume; `stop` (not destroy) preserves data overnight while pausing compute billing.
- **Cost**: ~$15/week running 24/7 (t3.large on-demand + 30GB gp3 EBS) + negligible ECR/S3 storage; less if stopped overnight.
