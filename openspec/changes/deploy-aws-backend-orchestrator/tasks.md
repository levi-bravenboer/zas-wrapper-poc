# Tasks: deploy-aws-backend-orchestrator

## 1. Images + compose for deploy
- [x] 1.1 New `orchestrator` Dockerfile — multi-stage: pnpm build → nginx serving `dist` + certbot
- [x] 1.2 nginx conf: host routing `app.zas.lebba.nl` → SPA + proxy `/.ory` → kratos; `api.zas.lebba.nl` → backend; 80 → 443 redirect + ACME challenge
- [x] 1.3 TLS: certbot (http-01) issuing SAN cert for `app.`/`api.zas.lebba.nl`
- [x] 1.4 `docker-compose.deploy.yml` — backend/worker/orchestrator reference ECR URIs via `${ECR_REGISTRY}/...:${IMAGE_TAG}` (no `build:`); public images unchanged; publish Postgres on `127.0.0.1:5432` only (loopback, for SSM tunnel)
- [x] 1.5 Temporal → shared Postgres: switch to `temporalio/auto-setup` (creates `temporal`/`temporal_visibility` schemas), `depends_on` db healthcheck; add temporal DB env
- [x] 1.6 Kratos: keep `--dev` but set `serve.public.base_url=https://app.zas.lebba.nl/.ory`
- [x] 1.7 URLs — internal stay docker service names (`BACKEND_KRATOS_ADMIN_URL=http://kratos:4434`, `_PUBLIC_URL=http://kratos:4433`, `BACKEND_KETO_READ_URL=http://keto:4466`, `_WRITE_URL=http://keto:4467`, `BACKEND_AUTHZ_KETO_ENABLED=true`); browser-facing → domain (Kratos `serve.public.base_url=https://app.../.ory`, SPA API base `https://api...`, backend CORS `https://app...`)
- [x] 1.8 `.env.deploy.example` documenting every required var (Postgres/Kratos/Keto/MinIO/Temporal creds + hostnames + `ECR_REGISTRY` + `IMAGE_TAG`)
- [x] 1.9 Ensure `apps/orchestrator/.env` (real `VITE_*`) exists for the build; document in `.env.deploy.example`
- [ ] 1.10 Verify the deploy compose boots locally against locally-built images

## 2. CDK app (`infra/cdk/`)
- [x] 2.1 Scaffold CDK TS app (`cdk init app --language typescript`), pin to repo Node 22
- [x] 2.1b `config/env.ts` + set explicit `env: { account, region: 'eu-west-1' }` on both stacks (required for `Vpc`/`HostedZone` `fromLookup`)
- [x] 2.2 `ZasEcrStack`: ECR repos for `backend` + `orchestrator`
- [x] 2.3 `ZasAppStack`: default VPC lookup, security group (80 + 443; SSM only)
- [x] 2.4 `ec2.Instance` — t3.large, Amazon Linux 2023, 30 GB gp3 EBS, IAM role (SSM + ECR pull + S3 read)
- [x] 2.5 Elastic IP + association for stable DNS across stop/start
- [x] 2.6 Route53: `HostedZone.fromLookup('zas.lebba.nl')` + A-records `app.` + `api.` → Elastic IP
- [x] 2.7 S3 config bucket (Block Public Access, SSE-KMS, private policy, `removalPolicy: DESTROY` + `autoDeleteObjects`) + `BucketDeployment` for `docker-compose.deploy.yml` + ory/nginx configs + staged `.env`; instance role read scoped to this bucket only; `instance.node.addDependency(bucketDeployment)` so the box boots only after upload
- [x] 2.8 UserData: install Docker + compose + AWS CLI; ECR `docker login` via role; `aws s3 sync` configs + `.env`; export `IMAGE_TAG` + `ECR_REGISTRY` for compose substitution; `docker compose -f docker-compose.deploy.yml pull && up -d`
- [x] 2.9 Inject hostnames + `imageTag` + `ECR_REGISTRY` via CDK context → UserData (NO secrets in context/template; secrets only via S3 `.env`)
- [x] 2.10 Stack outputs: app/api URLs, instance id, SSM connect command

## 3. Command system (moon + TypeScript/execa)
- [x] 3.1 Register `infra/cdk` in `.moon/workspace.yml`; add `infra/cdk/moon.yml` task defs
- [x] 3.2 `scripts/lib/`: `log.ts` (logger), `sh.ts` (execa wrapper, throws+typed), `preflight.ts` (checks: `aws sts get-caller-identity`, `docker info`, `apps/backend/.env` present, cdk bootstrapped, region eu-west-1)
- [x] 3.3 `scripts/deploy.ts` (`deploy:up`, deps preflight): cdk ECR → ecr login → build backend + orchestrator (bakes `apps/orchestrator/.env`) → tag(git sha) + push → stage `apps/backend/.env` into assets → cdk App `--context imageTag=<sha>`
- [x] 3.4 `scripts/images.ts` (`deploy:images`) — build + push only
- [x] 3.5 `scripts/destroy.ts` (`deploy:down`) — typed `DESTROY` confirm → `cdk destroy` both stacks
- [x] 3.6 `scripts/{status,logs,ssh}.ts` — EC2 state + container health + logs + shell via SSM
- [x] 3.7 `scripts/{start,stop}.ts` — EC2 start/stop (pause billing, keep data+EIP)
- [x] 3.8 `scripts/url.ts` — print app/api URLs from stack outputs
- [x] 3.9 Wrap every command in try/catch with typed failure message + nonzero exit
- [ ] 3.10 `cdk bootstrap` (account/region eu-west-1) — one-time prerequisite
- [x] 3.11 DB reachability (no task): keep Postgres published `127.0.0.1:5432` on box so ad-hoc SSM port-forward / `docker exec psql` works when needed

## 4. Deploy + validate
- [ ] 4.1 `moon run deploy:up`; confirm A-records resolve + all containers healthy (`moon run deploy:status`)
- [ ] 4.2 Confirm certbot issued the SAN cert (valid HTTPS on both hosts, no warning)
- [ ] 4.3 Smoke test: SPA loads at `app.`, **Kratos `--dev` login works over HTTPS** (watch cookie/CSRF), authz check via Keto, API call to `api.`, a Temporal-backed action. If login breaks → fallback proper kratos config (drop `--dev`)
- [ ] 4.4 Confirm Temporal persists: trigger a workflow, restart temporal container, state survives (Postgres-backed)
- [ ] 4.5 Confirm Postgres/Temporal/Keto/MinIO ports are NOT internet-reachable
- [ ] 4.6 Verify stop/start preserves data + DNS (EIP keeps A-records valid)

## 5. Seeding (minimal demo profile)
- [x] 5.1 Parameterize admin identity in `seed_users.py`: `BACKEND_BOOTSTRAP_ADMIN_EMAIL` (default `admin@zas.local`) + `_NAME`; replaces hardcoded `admin@zas.local`
- [x] 5.2 Demo seed entrypoint (`SEED_PROFILE=demo` or `seed_demo.py`): tenant → `admin` role → admin user → pathway prereqs → bladder pathway → Kratos link → Keto reconcile; reuses existing modules; excludes patients/practitioners/care teams
- [x] 5.3 Verify bladder pathway seed deps under minimal profile (specialisms/participants); include only required prerequisites
- [x] 5.4 Add to `.env.deploy.example`: `BACKEND_BOOTSTRAP_ADMIN_EMAIL` (`levi.bravenboer@reaktor.com`) + `_NAME` + `_PASSWORD`, `SEED_PROFILE=demo`, `BACKEND_AUTHZ_KETO_ENABLED=true`, internal Kratos/Keto URLs (secrets via S3)
- [x] 5.5 Entrypoint selects demo profile (`SEED_PROFILE=demo`) instead of `seed_all`; keeps `alembic upgrade head` → seed → backend order
- [x] 5.6 Compose boot ordering: backend `depends_on` db + kratos + keto **healthy** (add healthchecks) so seed's Kratos-import + Keto-reconcile don't no-op; idempotent on restart
- [ ] 5.7 Propagation verify: Postgres rows present, Kratos identity exists for admin (login works), Keto tuples reconciled + relay loop running (`BACKEND_AUTHZ_KETO_ENABLED=true`)
- [ ] 5.8 Smoke: log in as `levi.bravenboer@reaktor.com`, confirm admin sees everything + bladder pathway present, no demo patients/practitioners

## 7. Lifecycle + docs
- [x] 7.1 README in `infra/cdk/`: SSO + `moon run deploy:*` commands, stop/start, destroy, cost note, security caveat (dev-mode services)
- [ ] 7.2 Confirm `cdk destroy` (both stacks) removes 100% of billable resources (EC2, EBS, EIP, ECR images, S3) + cleans A-records
- [x] 7.3 Note teardown deadline (~1 week) so the box doesn't linger

## Out of scope (explicit)
- Patient app `digital-front-door`
- ALB / CloudFront / ACM (TLS via Let's Encrypt on box instead)
- Managed Postgres/S3, backups, HA, autoscaling, multi-env
- Production secret management
