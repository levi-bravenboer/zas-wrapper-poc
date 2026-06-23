## ADDED Requirements

### Requirement: Single-command ephemeral environment

The deploy tooling SHALL stand up the full backend + orchestrator stack on a single AWS EC2 instance from one command, and tear it down completely with one command. The environment is throwaway: no managed services, no high availability.

#### Scenario: Deploy from the CLI

- **WHEN** an operator with an active AWS SSO session runs `moon run deploy:up`
- **THEN** the ECR repositories are created, the `backend` and `orchestrator` images are built and pushed, and the application stack is provisioned (EC2, Elastic IP, Route53 records, S3 config bucket)
- **AND** the box boots the stack via docker-compose using images pulled from ECR

#### Scenario: One-command teardown

- **WHEN** the operator runs `moon run deploy:down` and confirms
- **THEN** both CloudFormation stacks are destroyed
- **AND** no billable resources (EC2, EBS, Elastic IP, ECR images, S3) remain

### Requirement: HTTPS over the project domain

The environment SHALL be reachable over HTTPS at stable hostnames in the existing `zas.lebba.nl` hosted zone, with TLS terminated on the box (no load balancer).

#### Scenario: Valid certificate on both hosts

- **WHEN** a browser opens `https://app.zas.lebba.nl` or `https://api.zas.lebba.nl`
- **THEN** a valid Let's Encrypt certificate is served
- **AND** nginx routes by host to the SPA and the backend respectively

#### Scenario: HTTP redirects to HTTPS

- **WHEN** a request arrives on port 80 (other than the ACME challenge path)
- **THEN** it is redirected to the HTTPS equivalent

### Requirement: Secrets never enter git or the deploy template

Runtime secrets SHALL be sourced from a local gitignored env file and delivered to the box through an encrypted S3 object, never committed to git nor embedded in the CloudFormation template.

#### Scenario: Secrets travel via encrypted S3

- **WHEN** `deploy:up` runs
- **THEN** the local `apps/backend/.env` is staged into the SSE-KMS config bucket
- **AND** the box syncs it on boot for docker-compose to consume
- **AND** no secret value appears in CloudFormation parameters or outputs

### Requirement: Minimal demo seed

On first boot the environment SHALL seed only the data a single-operator demo needs: one admin user (the deployer) and the bladder-cancer pathway, with identity and authorization propagated to Kratos and Keto.

#### Scenario: Admin and pathway are seeded

- **WHEN** the backend container starts with `SEED_PROFILE=demo`
- **THEN** the configured admin email is seeded with the `admin` role and imported as a Kratos identity that can log in
- **AND** the bladder-cancer pathway is authored and published
- **AND** no demo patients, practitioners, or care teams are seeded

### Requirement: Internal services are not internet-reachable

Only the HTTPS entry point SHALL be exposed to the internet. Postgres, Temporal, Keto, and MinIO SHALL be reachable only on the box's internal network (object storage is fronted by nginx for browser presigned access).

#### Scenario: Internal ports are closed

- **WHEN** an external client attempts to connect to the instance on the Postgres, Temporal, Keto, or MinIO ports
- **THEN** the connection is refused (security group exposes only 80 and 443)
