## Context

Throwaway demo: 1 reviewer, ~1 week, lowest cost, one-command kill. The stack is heavy (8 containers: Postgres shared by backend/Kratos/Keto/Temporal, Kratos, Keto, MinIO, Temporal, backend, worker) but it already runs as a unit via `docker-compose.yml`. The cheapest correct move is to lift that unit onto one VM rather than decompose it into managed services. EU region (eu-west-1) for Belgian data residency.

## Goals / Non-Goals

**Goals**
- One `cdk deploy` stands up a reachable backend + orchestrator over HTTPS at `app.`/`api.zas.lebba.nl`.
- One `cdk destroy` removes 100% of billable resources.
- Reuse `docker-compose.yml` with minimal edits (add orchestrator + TLS, repoint URLs).
- Keep cost ~$15/week; allow stop/start to pause compute.

**Non-Goals**
- ALB / CloudFront / ACM (TLS terminates on the box via Let's Encrypt instead).
- Managed Postgres/S3, backups, HA, autoscaling.
- Patient app (`digital-front-door`).
- Production secret management (Secrets Manager) — plain env is acceptable here.

## Decisions

### Compute: single EC2 + docker-compose
- **Instance**: `t3.large` (2 vCPU / 8 GB) baseline; `t3.xlarge` if Temporal+Kratos+Keto+Postgres+MinIO contend. Amazon Linux 2023.
- **Storage**: 30 GB gp3 root EBS holds all docker volumes (`zas_pgdata`, `zas_minio_data`).
- **Network**: default VPC, public subnet, Elastic IP (stable DNS across stop/start). Security group opens only the ports the demo needs (see below) to the reviewer's IP if known, else `0.0.0.0/0` for the week.
- **Rejected**: Fargate+RDS+S3+CloudFront (NAT/RDS cost, slow lifecycle); Lightsail (weaker IaC kill story); Lambda (explicitly excluded, stateful stack unfit).

### Stateful services on the box
- **Temporal → persists to the shared Postgres** (not `start-dev`). Use the `temporalio/auto-setup` image (or temporal server configured with `--db postgres12`): on boot it creates the `temporal` + `temporal_visibility` schemas in the box Postgres and runs against them. Workflow state survives container restart / `stop`-`start`. Adds a temporal DB-init dependency on Postgres (ordering in compose) and the temporal env (DB host/user/pwd) into `.env`.
- **Kratos keeps `--dev`** (accepted risk). `serve.public.base_url` still set to `https://app.zas.lebba.nl/.ory`. **Risk:** `--dev` relaxes secure-cookie/CSRF handling — login over the real HTTPS domain may misbehave (cookie domain / CSRF mismatch). **Fallback if auth breaks in smoke test:** drop `--dev` and set proper cookie domain + CSRF + secure cookies. Tracked in Risks.
- **Postgres / Keto / MinIO**: unchanged from local compose; Postgres is the single shared DB (backend, kratos, keto, temporal).

### Seeding: minimal demo profile
- Seeding already exists and is idempotent (`apps/backend/scripts/seed_*.py`, orchestrated by `seed_all.py`, run on backend container entrypoint). The `admin` role already holds all permissions incl. `PATIENT_ACCESS_ALL` (sees everything); `seed_bladder_cancer.py` already authors + publishes the bladder pathway. So this is configuration, not new seed logic.
- **Demo subset** (not full `seed_all`): tenant → `admin` role → single admin user (= me) → pathway prerequisites (specialisms/participants the pathway references) → bladder-cancer pathway → Kratos identity link → Keto reconcile. **Excludes** demo patients / practitioners / care teams.
- **Mechanism**: a `SEED_PROFILE=demo` switch (or `seed_demo.py`) that calls the needed existing modules in dependency order — reuse, don't rewrite. Verify the bladder pathway seed's real deps under the minimal set and include only those prerequisites.
- **Admin identity parameterized**: `seed_users.py` currently hardcodes `admin@zas.local`. Add `BACKEND_BOOTSTRAP_ADMIN_EMAIL` (default `admin@zas.local`) + `_NAME`; deploy `.env` sets it to `levi.bravenboer@reaktor.com`. Password via existing `BACKEND_BOOTSTRAP_ADMIN_PASSWORD`. These ride the S3 `.env` secrets path.
- **Ordering on the box**: entrypoint runs the demo seed after Postgres is healthy; the Kratos identity link step needs Kratos up → compose `depends_on` + retry. Idempotent, so re-run on restart is safe.

### Seed propagation chain (Postgres → Kratos → Keto)
The backend entrypoint (`apps/backend/docker/entrypoint.sh`) already runs `alembic upgrade head` → seed → backend. The demo profile must drive the **full chain** so the admin + pathway show up everywhere:
1. **Postgres** — `alembic upgrade head` (schema) → demo seed writes tenant/role/admin-user/pathway rows.
2. **Kratos** — `import_identities_kratos.py` (called by the seed) imports the admin's email + argon2id hash via the **admin API** → login works, no reset. Needs Kratos reachable at seed time (else skipped with warning; re-run to fix).
3. **Keto** — `reconcile_all()` one-shot at seed derives tuples from Postgres; the **in-process relay loop** (`run_relay_loop`, started in app lifespan when `BACKEND_AUTHZ_KETO_ENABLED=true`) drains the `AuthzOutbox` every 2s for ongoing sync. No separate service — relay lives in the backend process. Must set `BACKEND_AUTHZ_KETO_ENABLED=true`.
- **Entrypoint must select the demo profile** (`SEED_PROFILE=demo`) instead of full `seed_all`.
- **Boot ordering is load-bearing**: backend `depends_on` db + kratos + keto **healthy** (healthchecks) so the seed's Kratos-import + Keto-reconcile steps don't no-op. Idempotent re-run on restart recovers if a dependency was late.
- Admin has `PATIENT_ACCESS_ALL` (RBAC Keto-bypass) so it sees everything even before tuples land; pathway/carepath tuples still reconcile for correctness.

### IaC: CDK (TypeScript), two stacks
- Matches the orchestrator language; `cdk deploy` / `cdk destroy` give the lifecycle. Lives in `infra/cdk/` (sibling to existing `infra/ory/`).
- **`ZasEcrStack`**: ECR repositories for `backend` + `orchestrator`. Deployed first so images can be pushed before the app stack consumes them (solves the repo-before-push / push-before-run chicken-egg).
- **`ZasAppStack`**: `ec2.Instance`, `ec2.SecurityGroup`, `ec2.CfnEIP` + association, IAM instance role (SSM + ECR pull + S3 read), `ec2.UserData`, Route53 `ARecord` x2 from the existing `zas.lebba.nl` hosted zone (lookup) → the Elastic IP, and an S3 bucket + `s3deploy.BucketDeployment` that uploads compose + ory/nginx configs at deploy time. Takes `imageTag` via context.
- **Explicit `env` required.** `Vpc.fromLookup` + `HostedZone.fromLookup` are context lookups → the stacks MUST set `env: { account, region }` (from `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` off the SSO session); env-agnostic synth would fail. `config/env.ts` centralizes account/region (eu-west-1). The `zas.lebba.nl` zone is confirmed in the same target account.

### Image build + delivery: ECR (built on CLI, not on box)
- Two custom images: `backend` (existing `apps/backend/Dockerfile`; worker reuses it) and `orchestrator` (new multi-stage Dockerfile — pnpm build → nginx + certbot). Public images (postgres, kratos, keto, minio, temporal) pull from Docker Hub.
- Built on the developer machine and pushed to ECR, tagged with the git sha. The box only `docker compose pull`s — no source, no Node/pnpm, no build toolchain, no repo creds on the instance.
- **Rejected: build on box / git clone** — would put source + build toolchain (and a private-repo deploy token) on the instance, slower boot, heavier box. ECR keeps the box minimal and credential-free.

### Config delivery: S3 (via CDK BucketDeployment)
- `docker-compose.deploy.yml` + ory configs (`infra/ory/kratos/*`, keto configs) + nginx conf uploaded to an S3 bucket as part of `cdk deploy`. The box `aws s3 sync`s them on boot (instance role grants read).
- **Rejected: bake configs into images** (more custom images to build/push) and **shallow git clone** (needs a repo deploy token). S3 is AWS-native, keeps configs editable, and rides along in the CLI deploy.

### Secrets delivery: local `.env` → S3 (SSE-KMS)
- Source of truth stays the local gitignored `.env` files used today (`apps/backend/.env` feeds backend + worker via compose `env_file`; only `.env.example` is committed).
- **`deploy:up` (deploy.ts) stages the local `.env`** into the BucketDeployment asset dir; `cdk deploy` uploads it to the bucket; the box `aws s3 sync`s it and compose `env_file` reads it unchanged.
- **Never in git, never in the CloudFormation template** (CDK context/params would leak to the CF console — explicitly avoided).
- Bucket hardening (required, not optional): S3 **Block Public Access** on, **SSE-KMS** default encryption, bucket policy private, instance role read scoped to this bucket only, `removalPolicy: DESTROY`.
- **Frontend env is build-time** (`VITE_*` inlined by Vite) — resolved from local `apps/orchestrator/.env` during `docker build` in `deploy.ts` and baked into the image; it never reaches the box or the bucket.
- **Rejected: SSM Parameter Store** (tighter — per-param IAM + CloudTrail audit) — overkill for a 1-week throwaway; S3 reuses the one mechanism. **Rejected: baking secrets into the image** (cached layers, shared on pull).

### Deploy UX: moon tasks → TypeScript scripts (execa), off SSO
- `infra/cdk` is registered as a moon project; tasks are the front door (discoverable, task deps, consistent with `/verify`). Orchestration glue is **TypeScript via execa/zx** (typed, matches repo lang), not bash.
- Task set:
  - `deploy:preflight` — gate; fail fast with exact fix message: `aws sts get-caller-identity` (SSO active), `docker info` (daemon up), `apps/backend/.env` present, cdk bootstrapped, region == eu-west-1.
  - `deploy:up` (deps: preflight) — sequence: `cdk deploy ZasEcrStack` → ecr login → build backend + orchestrator → tag(git sha) + push → stage `.env` into assets → `cdk deploy ZasAppStack --context imageTag=<sha>`.
  - `deploy:images` — build + push only.
  - `deploy:down` — typed `DESTROY` confirm → `cdk destroy` both stacks.
  - `deploy:status` / `deploy:logs` / `deploy:ssh` — EC2 state + container health + logs + shell via SSM.
  - `deploy:stop` / `deploy:start` — EC2 stop/start (pause billing, keep data + EIP).
  - `deploy:url` — print app/api URLs.
- Error handling: execa throws on non-zero; each command wraps in try/catch with a typed failure message; shared `scripts/lib/` (`log.ts`, `sh.ts` execa wrapper, `preflight.ts`). Idempotent — re-running `up` re-pushes + `cdk deploy` (no-op if unchanged).
- No CI pipeline — deploy is intentionally local for a one-week demo.

### Command-system layout
```
infra/cdk/
├── moon.yml                  # tasks → tsx scripts; up deps preflight
├── package.json              # aws-cdk-lib, execa/zx, tsx, constructs
├── tsconfig.json  cdk.json
├── bin/zas-deploy.ts         # cdk app entry
├── lib/{ecr-stack,app-stack,user-data}.ts
├── lib/constructs/{networking,compute,dns,config-bucket}.ts
├── config/env.ts
├── assets/                   # docker-compose.deploy.yml, nginx/, ory/, staged .env
└── scripts/
    ├── lib/{log,sh,preflight,ssm}.ts
    └── {deploy,images,destroy,status,start,stop,logs,ssh,url}.ts
```
- Register `infra/cdk` in `.moon/workspace.yml` projects.

### DNS + TLS: Route53 + Let's Encrypt (no ALB)
- Existing hosted zone `zas.lebba.nl` (CDK `HostedZone.fromLookup`). Add A-records `app.zas.lebba.nl` + `api.zas.lebba.nl` → the Elastic IP.
- **TLS terminates on the box** via certbot in the nginx container. SAN cert covering both hostnames issued on first boot via the http-01 challenge (port 80 must be reachable during issuance).
- **Rejected: ACM + ALB** — ACM public certs cannot attach to bare EC2; would force an ALB (~+$16/wk) for one user. Let's Encrypt keeps cost flat and TLS on the instance.
- Cert renewal not a concern for a 1-week box (90-day LE validity); certbot timer included anyway, harmless.

### Bootstrap: user-data
On first boot the instance: installs Docker + compose plugin + AWS CLI; `docker login` to ECR via the instance role; `aws s3 sync` the bucket (compose + configs + `.env`); exports `IMAGE_TAG` + `ECR_REGISTRY` (injected via CDK context → user-data) so the compose `${IMAGE_TAG}` / `${ECR_REGISTRY}` substitutions resolve the right image URIs; `docker compose -f docker-compose.deploy.yml pull && up -d`; certbot issues the cert. The `.env` comes from S3 (NOT CDK context — secrets never touch the template). No build, no clone. Idempotent enough for a single-shot demo.

### Orchestrator serving + host routing
- `orchestrator` is its own ECR image (multi-stage: pnpm build → nginx serving `dist` + certbot, TLS terminating). The compose file references the ECR URI; the box pulls it.
- nginx routes by `Host`:
  - `app.zas.lebba.nl` → serve SPA; proxy `/.ory` → Kratos public (same-origin, avoids CORS).
  - `api.zas.lebba.nl` → proxy to backend.
- Port 80 → 301 redirect to 443 (also serves the ACME http-01 challenge during issuance).

### URL / config repointing — internal vs browser-facing
Ory runs on the same box, so backend↔Ory traffic stays on the docker network. Only browser-facing URLs use the real domain.

**Internal (docker service names — UNCHANGED from compose):**
- `BACKEND_KRATOS_ADMIN_URL=http://kratos:4434` (identity import)
- `BACKEND_KRATOS_PUBLIC_URL=http://kratos:4433` (backend whoami)
- `BACKEND_KETO_READ_URL=http://keto:4466`, `BACKEND_KETO_WRITE_URL=http://keto:4467`
- `BACKEND_AUTHZ_KETO_ENABLED=true` (enables checks + relay loop)

**Browser-facing (→ real domain):**
- Kratos `serve.public.base_url` → `https://app.zas.lebba.nl/.ory` (self-service flows the SPA hits, proxied by nginx).
- SPA API base (`VITE_*`, build-time) → `https://api.zas.lebba.nl`.
- Backend CORS allowed origins → `https://app.zas.lebba.nl`.

Hostnames are fixed (known before deploy), so config is static; secrets ride the S3 `.env`.

### Ports / security
- Inbound SG: 443 (HTTPS) + 80 (redirect + ACME challenge) only. Postgres/Temporal/Keto/MinIO are NOT in the SG → unreachable from internet.
- SG source: lock to known IP if available, else `0.0.0.0/0` for the week (HTTPS + throwaway creds + prompt destroy).
- SSM Session Manager for shell + tunnels — no inbound SSH, no key management.
- **DB access (ad-hoc, no dedicated command)**: deploy compose publishes Postgres on `127.0.0.1:5432` of the box (loopback only, never the public iface). When needed, reach it via SSM — either `aws ssm start-session ... AWS-StartPortForwardingSession` (box `5432` → `localhost:5432`, then local `psql`/GUI) or `deploy:ssh` + `docker exec -it db psql`. No DB port ever in the SG. The setup supports it; no task is shipped for it.

### Data lifecycle
- Ephemeral by design. `cdk destroy` deletes instance + EBS → all data gone (intended).
- Overnight: `aws ec2 stop-instances` pauses compute billing; EBS + Elastic IP persist so data and DNS survive. `start-instances` resumes.

## Risks / Trade-offs

- **Single point of failure** — one box, no redundancy. Acceptable for 1 user / 1 week.
- **Kratos `--dev` on a real HTTPS domain** — relaxed secure-cookie/CSRF; login flows may break over `https://app.zas.lebba.nl`. Accepted for throwaway; fallback = proper kratos config (drop `--dev`, set cookie domain + CSRF + secure cookies). Verify in smoke test (4.3). Do not reuse `--dev` for anything real.
- **Temporal auto-setup** — creates schemas in the shared Postgres on first boot; if Postgres isn't ready, temporal init retries (compose `depends_on` + healthcheck on db).
- **Open security group** — if reviewer IP unknown, 80/443 are world-open for the week. Mitigate by restricting to known IP, and destroy promptly.
- **RAM contention** — if t3.large OOMs under the 8-container load, bump to t3.xlarge (cost ~$28/week).
- **ACME on first boot** — http-01 challenge needs port 80 open and DNS already resolving to the EIP at boot. CDK creates A-records, but DNS propagation can lag user-data; certbot retries until the record resolves.

## Migration Plan

1. Land CDK app (`ZasEcrStack` + `ZasAppStack`), moon `deploy:*` tasks + TS scripts, orchestrator Dockerfile, `docker-compose.deploy.yml` + configs on `feat/deploy-aws` (no effect on local dev).
2. `cdk bootstrap` (once per account/region).
3. `aws sso login`, then `moon run deploy:up` (preflight → ECR stack → build/push → app stack).
4. Smoke test over `app.`/`api.zas.lebba.nl`; share link with reviewer.
5. After the week: `cdk destroy` both stacks. Confirm zero residual billable resources (EC2, EBS, EIP, ECR images, S3, A-records).

## Resolved Decisions

- **Domain/TLS**: existing Route53 zone `zas.lebba.nl`; `app.` + `api.` subdomains; Let's Encrypt on the box (no ALB).
- **Image build/delivery**: custom images built on the CLI → ECR; box only pulls (no on-box build, no git clone).
- **Config delivery**: S3 via CDK `BucketDeployment`.
- **Secrets delivery**: local `.env` → S3 (SSE-KMS, private) → box; frontend env baked at build. No git, no CF template, no SSM.
- **Deploy UX**: moon tasks (`deploy:up/down/status/...`) → TypeScript (execa) scripts, off SSO; no CI.
- **Temporal**: persists to shared Postgres (auto-setup), not `start-dev`.
- **Kratos**: keeps `--dev`; accepted risk on real HTTPS domain (fallback = proper config).
- **DNS account**: `zas.lebba.nl` zone is in the same target account → `fromLookup` works.
- **Env file**: new `.env.deploy.example` template (distinct from local dev `.env`).

## Open Questions

- Reviewer's source IP for security-group lock-down (else 80/443 world-open for the week)?
