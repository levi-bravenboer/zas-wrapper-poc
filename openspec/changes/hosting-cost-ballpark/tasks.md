# Tasks — Hosting Cost Ballpark

## 1. Phase 1 — Needs format & capture

- [x] 1.1 Design the `docs/hosting-costs/data/needs.yaml` format: components (name, resource needs, HA flag, managed-mapping slot), cross-cutting needs, and per-tier scaling numbers; document the format at the top of the file
- [x] 1.2 Fill component inventory from `docker-compose.deploy.yml` into `needs.yaml` + write the human-readable `docs/hosting-costs/inventory.md`
- [x] 1.3 Baseline capture with Levi: projection-table numbers (2027/2030/2036) into `needs.yaml` `given`; derived load figures added with `confirmed: false`; unknowns listed in `docs/hosting-costs/open-questions.md` (OQ1-OQ7)
- [ ] 1.4 Levi signs off `derived` figures + answers OQ1-OQ7 with the right people; fold answers into `needs.yaml`, flip `confirmed: true`
- [ ] 1.5 Derive per-component vCPU/RAM sizing per tier from confirmed numbers; record rationale in `docs/hosting-costs/tiers.md`

> NOTE 2026-08-06: executed ahead of plan in chat session. Stack decisions (custom
> engine, Keycloak, native object storage) in `stack-choices.md`; prices in
> `data/prices.*.json` (JSON not YAML — stdlib calc.py has no yaml parser); deliverable
> generated at `docs/hosting-costs/breakdown/v1.html`. Remaining: AWS price verification,
> OQ1 (HiX VPN), tiers.md rationale doc.

## 2. Phase 2 — Provider service selection

- [ ] 2.1 AWS `docs/hosting-costs/aws.md`: pick concrete services per need for shape A (EC2/EBS/snapshots) and shape B (RDS, S3, ECS Fargate, ALB), with reasoning
- [ ] 2.2 Azure `docs/hosting-costs/azure.md`: same (VMs/disks vs Azure Database for PostgreSQL, Blob, Container Apps, Front Door)
- [ ] 2.3 GCP `docs/hosting-costs/gcp.md`: same (Compute Engine/PD vs Cloud SQL, GCS, Cloud Run, HTTPS LB)
- [ ] 2.4 Note Temporal Cloud and Ory Network as severable optional line items with their pricing model per tier

## 3. Phase 3 — Prices & calculator

- [ ] 3.1 Define `data/prices.<provider>.yaml` format: priced unit, EUR rate, source URL, retrieval date, EU region
- [ ] 3.2 Fill `prices.aws.yaml`, `prices.azure.yaml`, `prices.gcp.yaml` from public list prices (EU regions only, dated, stated USD→EUR rate)
- [ ] 3.3 Build `docs/hosting-costs/calc.py` (stdlib-only): needs × prices → per-cell monthly + yearly EUR with per-component line items; environment aggregation (prod + staging ~25% + dev/demo minimal) inside the calc
- [ ] 3.4 Add 1-yr commitment sensitivity as a calc option per provider

## 4. Matrix & recommendation

- [ ] 4.1 Generate the 18-cell summary matrix (3 providers × 2 shapes × 3 tiers, monthly + yearly) into `docs/hosting-costs/README.md` with ±30% list-price disclaimer above it
- [ ] 4.2 Write per-tier recommendation (provider + shape, reasoning: cost, ops burden, residency) leading with the recommended option
- [ ] 4.3 Document refresh procedure: how to re-source prices and re-run `calc.py`

## 5. Review

- [ ] 5.1 Cross-check: every matrix cell reproduces from `calc.py`; every price has source+date; no non-EU region; no figure bypasses `needs.yaml`
- [ ] 5.2 Walk through README with Levi; capture open-question answers (compliance/residency, HA per tier, Luscii cost assumption) into the docs
