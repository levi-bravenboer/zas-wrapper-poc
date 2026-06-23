# ZAS ephemeral AWS deploy

Throwaway demo of **backend + orchestrator** on a single EC2 box for ~1 week,
then one command to kill it. Not production infra.

- One `t3.large` runs the whole stack via `docker-compose.deploy.yml`
  (Postgres, Temporal, Kratos, Keto, MinIO, backend, worker, orchestrator).
- Custom images (`zas-backend`, `zas-orchestrator`) built locally → ECR; the
  box only pulls. Compose + ory/nginx configs + secrets come from S3.
- **Durable data**: a dedicated, RETAINED EBS volume (`Name=zas-data`) backs
  Docker's `data-root`, so Postgres/MinIO/LE certs survive instance
  replacement *and* `deploy:down`. The deploy flow cannot wipe the database.
- **Code rollouts are in-place**: `deploy:up` / `deploy:images` build+push, then
  pull+recompose on the running box via SSM (the image tag lives in S3
  `tag.env`, never in UserData). The instance is only replaced on genuine
  boot-script changes — and even then the data volume reattaches.
- HTTPS via Let's Encrypt on the box; Route53 `app.`/`api.zas.lebba.nl` → one
  Elastic IP. No ALB.
- Seeds a single admin (you) + the bladder-cancer pathway (`SEED_PROFILE=demo`).

## Prerequisites

- `aws sso login` active (eu-west-1)
- Docker running locally
- `infra/cdk` deps: `pnpm install`
- Real secrets in `apps/backend/.env` (copy `/.env.deploy.example`, fill values)
- One-time per account/region: `npx cdk bootstrap`

## Commands (`moon run deploy:<task>`)

| Command | What it does |
|---|---|
| `deploy:preflight` | Gate: SSO active, Docker up, `.env` present, bootstrapped, region |
| `deploy:up` | ECR stack → build+push images → app stack (full deploy) |
| `deploy:images` | Build + push images only |
| `deploy:status` | EC2 state + `docker compose ps` (via SSM) |
| `deploy:logs` | Tail container logs (via SSM) |
| `deploy:ssh` | SSM shell into the box |
| `deploy:stop` | Stop EC2 — pause billing, keep data + EIP/DNS |
| `deploy:start` | Start EC2 again |
| `deploy:url` | Print app/api URLs |
| `deploy:down` | Destroy everything (typed `DESTROY` confirm) |

Lock the security group to your IP: `npx cdk deploy ZasAppStack -c allowedCidr=<your-ip>/32`
(otherwise 80/443 are world-open for the week).

## Lifecycle

```sh
aws sso login
moon run deploy:up        # stand up
moon run deploy:url       # grab the link, share with reviewer
moon run deploy:stop      # overnight: pause compute (data + DNS survive)
moon run deploy:start     # resume
moon run deploy:down      # end of week: tear down 100%
```

## Cost

~$15/week running 24/7 (t3.large on-demand + 30 GB gp3) + negligible ECR/S3.
Stop overnight to roughly halve it.

## Security caveats (accepted for a throwaway)

- **Kratos `--dev`** on a real HTTPS domain — relaxed cookie/CSRF. If login
  misbehaves, drop `--dev` and set cookie domain + CSRF + secure cookies.
- **Temporal** persists to the shared Postgres (auto-setup) — state survives
  restart, but this is still a single un-backed-up box.
- HTTP creds traverse only inside the box's docker network; only nginx
  (80/443) is exposed. Postgres/Temporal/Keto/MinIO are loopback/internal —
  reach Postgres via `aws ssm start-session ... AWS-StartPortForwardingSession`.
- Secrets live in `apps/backend/.env` (gitignored) → SSE-KMS S3 → box; never
  in git or the CloudFormation template.

## Teardown deadline

This box is meant to live ~1 week. **Run `moon run deploy:down` when the demo
ends** so it doesn't linger and bill. Verify the console shows no residual
EC2 / EIP / ECR / S3 afterwards.

`deploy:down` deliberately **keeps** the `zas-data` EBS volume (RETAIN) so a
teardown can never lose the database. It's ~30 GB gp3 (~$2.4/mo) until you
delete it by hand — `deploy:down` prints the exact `delete-volume` command.
