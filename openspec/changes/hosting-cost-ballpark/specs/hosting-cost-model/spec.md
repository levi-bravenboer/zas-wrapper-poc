# Spec: hosting-cost-model

## ADDED Requirements

### Requirement: Infra inventory covers the full deployed stack
The cost model SHALL include an inventory (`docs/hosting-costs/inventory.md`) listing every component the production stack hosts, derived from `docker-compose.deploy.yml`: Postgres 17 (app, kratos, keto, temporal, temporal_visibility databases), Ory Kratos, Ory Keto, object storage for attachments (MinIO or provider equivalent), Temporal server, pathway worker, FastAPI backend, orchestrator SPA + reverse proxy/TLS. It SHALL also list cross-cutting needs: backups, monitoring/logging, egress, DNS/TLS certificates, container registry.

#### Scenario: Inventory matches deploy stack
- **WHEN** a service exists in `docker-compose.deploy.yml`
- **THEN** the inventory lists it (or explicitly maps it to a provider-managed replacement)

#### Scenario: Cross-cutting costs not omitted
- **WHEN** the cost matrix is produced for any provider/shape/tier cell
- **THEN** backups, monitoring, egress, DNS/TLS, and registry each appear as line items or as an explicitly stated €0

### Requirement: Structured needs format captures inventory and scaling
The cost model SHALL define a structured needs format (`docs/hosting-costs/data/needs.yaml`) that records, in one machine-readable place: every hosted component with its resource needs (vCPU, RAM, storage, HA), the cross-cutting needs, and the scaling numbers per tier (active caregivers, active patients, peak API req/s, Postgres size, object storage size, concurrent open pathway workflows, monthly egress). Scaling numbers SHALL be supplied by the project owner; the model SHALL NOT invent them.

#### Scenario: Needs are the single source
- **WHEN** any sizing or scaling figure is used in pricing or docs
- **THEN** it traces back to a field in `needs.yaml`

#### Scenario: Pricing blocked on unconfirmed needs
- **WHEN** the project owner has not supplied/confirmed the scaling numbers in `needs.yaml`
- **THEN** no provider cost figures are published in the matrix

### Requirement: Costs are calculated, monthly and yearly
The cost model SHALL compute costs via a calculator (`docs/hosting-costs/calc.py`, stdlib-only) that combines `needs.yaml` with per-provider dated price files (`data/prices.<provider>.yaml`) and outputs both monthly and yearly EUR figures per matrix cell with per-component line items. Published matrix numbers SHALL be calculator output, not hand-maintained.

#### Scenario: Recalculation on changed needs
- **WHEN** a scaling number in `needs.yaml` changes and the calculator re-runs
- **THEN** all affected matrix cells update without manual table edits

#### Scenario: Monthly and yearly both present
- **WHEN** the calculator output is rendered
- **THEN** each matrix cell shows a monthly and a yearly EUR figure

### Requirement: Cost matrix spans all model dimensions
The cost model SHALL produce a monthly-EUR cost matrix covering: providers {AWS, Azure, GCP} × deployment shapes {VM + compose, managed services} × scaling tiers {T1, T2, T3}, with the environment set (prod + staging + dev/demo) aggregated per cell and a per-component breakdown available in the provider docs.

#### Scenario: Complete matrix
- **WHEN** the README summary matrix is rendered
- **THEN** all 18 cells (3 providers × 2 shapes × 3 tiers) contain a monthly EUR figure

#### Scenario: Breakdown reachable
- **WHEN** a reader questions a matrix cell
- **THEN** the per-provider doc shows the per-component line items that sum to that cell

#### Scenario: Optional managed vendors severable
- **WHEN** Temporal Cloud or Ory Network pricing is shown
- **THEN** it appears as a separate optional line item, not folded into the base matrix cells

### Requirement: Prices are sourced, dated, and EU-region
Every price in the model SHALL be a public list price for an EU region (AWS eu-west-1/eu-central-1, Azure West Europe, GCP europe-west4), carry a source link and retrieval date, use a stated USD→EUR conversion rate where needed, and exclude negotiated or committed-use discounts from base figures (commitment pricing MAY appear as a clearly labelled sensitivity row).

#### Scenario: Traceable price
- **WHEN** any monthly figure appears in the docs
- **THEN** it links to its list-price source and states the retrieval date

#### Scenario: Non-EU region rejected
- **WHEN** a component is priced
- **THEN** the price is taken from one of the designated EU regions

### Requirement: Recommendation with reasoning
The cost model SHALL close with a recommendation in `docs/hosting-costs/README.md`: which provider/shape combination fits each tier, leading with the recommended option and its reasoning (cost, ops burden, residency fit), not a neutral option list. The README SHALL carry a ±30% ballpark disclaimer.

#### Scenario: Recommendation present per tier
- **WHEN** the README is read
- **THEN** each tier has one recommended provider+shape with stated reasoning

#### Scenario: Ballpark framed as ballpark
- **WHEN** the README is read
- **THEN** a ±30%, list-price, no-discounts disclaimer is visible before the matrix
