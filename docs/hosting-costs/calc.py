#!/usr/bin/env python3
"""ZAS hosting cost calculator.

Combines tier sizing (mirrors data/needs.yaml) with per-provider unit prices
(data/prices.<provider>.json) and renders the full breakdown as a
self-contained HTML report (breakdown/v3.html) plus a console summary.

stdlib-only. Run: python3 calc.py
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
OUT = HERE / "breakdown" / "v4.html"
H = 730  # hours/month

# ---------------------------------------------------------------- sizing
# Derived from data/needs.yaml tiers (given numbers -> component sizing).
# Env model: prod at tier, staging = 25% of prod cost, dev/demo = fixed small VM.
TIERS = {
    "2027": {
        "label": "2027 · MVP production",
        "given": "55k MAU · 20k pathway patients/yr · 4 pathways",
        "db_sku": "pg_4x16_ha", "db_gb": 100,
        "containers": {"backend": (2, 1, 2), "worker": (2, 1, 2), "keycloak": (1, 2, 4)},
        "vm_app": [("vm_8x32", 1)], "vm_db": [("vm_4x16", 2)],
        "vm_disk_gb": 500, "vm_snap_gb": 400, "vm_lb": False,
        "obj_gb": 250, "egress_gb": 250,
    },
    "2030": {
        "label": "2030 · full production",
        "given": "80k MAU · 60k pathway patients/yr · >15 pathways",
        "db_sku": "pg_8x32_ha", "db_gb": 500,
        "containers": {"backend": (3, 2, 4), "worker": (3, 2, 4), "keycloak": (2, 2, 4)},
        "vm_app": [("vm_8x32", 2)], "vm_db": [("vm_8x32", 2)],
        "vm_disk_gb": 1200, "vm_snap_gb": 1000, "vm_lb": True,
        "obj_gb": 1200, "egress_gb": 750,
    },
    "2036": {
        "label": "2036 · scaled production",
        "given": "155k MAU · 250k pathway patients/yr · >50 pathways",
        "db_sku": "pg_16x64_ha", "db_gb": 2000,
        "containers": {"backend": (6, 2, 4), "worker": (6, 2, 4), "keycloak": (2, 2, 4)},
        "vm_app": [("vm_16x64", 3)], "vm_db": [("vm_16x64", 2)],
        "vm_disk_gb": 5300, "vm_snap_gb": 4000, "vm_lb": True,
        "obj_gb": 8000, "egress_gb": 3000,
    },
}
STAGING_RATIO = 0.25

# ---------------------------------------------------------------- narrative
SERVICES = [
    ("PostgreSQL database — highly available",
     "Single relational store for everything operational: pathway state and scheduling for the custom engine, "
     "tasks, caregiver actions, the FHIR-aligned audit trail, Keycloak's identity data.",
     "Primary + synchronous standby in two zones (multi-AZ) with point-in-time recovery — backs the committed "
     "99.9% SLA and the NIS2 continuity duty. Biggest single line at every tier.",
     "patients in pathways · 5-yr rolling retention (75 GB → 350 GB → 2 TB)"),
    ("Backend API",
     "REST API for the caregiver orchestrator (SPA) and the patient app, plus server-sent events for live updates.",
     "SSE means long-lived connections — instances always-on (no scale-to-zero), raised LB idle timeouts. Two small "
     "replicas at MVP for zero-downtime deploys.",
     "peak requests (sizing 100 → 150 → 300 req/s)"),
    ("Background worker — custom pathway engine",
     "Separate process for the engine's timers, polling and retries ('wound check due in 3 days'). Custom-built for "
     "MVP — the PoC's Temporal cluster was decided out.",
     "Isolated from the API so a burst of due tasks can't starve user requests. Same image, different entrypoint.",
     "open enrollments (8k → 23k → 110k concurrent)"),
    ("Keycloak — identity",
     "Login and accounts for caregivers and patients, brokering the Belgian eHealth OIDC instance as upstream IdP.",
     "Self-hosted on purpose: managed IdPs (Ory Network, Cognito, Entra External ID) bill per MAU — at 55k–155k MAU "
     "that fee dwarfs the one container it replaces. Authorization becomes app-level RBAC in the backend.",
     "identity count — effectively flat (one JVM container)"),
    ("Object storage — attachments",
     "Wound photos and documents via presigned URLs, so files never stream through the backend.",
     "Native provider storage (S3 / Blob / GCS) in both shapes — 11-nines durability, lifecycle rules, ~€0.02/GB. "
     "PoC's MinIO stays dev-only.",
     "~10 MB per pathway patient (250 GB → 1.2 TB → 8 TB)"),
    ("Load balancer / reverse proxy",
     "TLS termination, host routing, serving the SPA, raised idle timeouts for SSE.",
     "Single-VM MVP does this with nginx on the box; from two app nodes (2030+) and in the managed shape it's the "
     "provider's LB.",
     "flat"),
    ("Cross-cutting: monitoring, backups, registry, DNS, egress",
     "Provider-native logging/metrics/alerting (SLA + NIS2 incident duty), DB + storage backups, container registry, "
     "one DNS zone, internet egress.",
     "Small individually, always present — every matrix cell includes them so nothing hides.",
     "egress scales with usage (250 GB → 750 GB → 3 TB/mo)"),
]

NOT_ON_BILL = [
    ("Video, messaging, questionnaires", "run on Luscii's infrastructure (SDK reused as-is) — also why our credible SLA ceiling is Luscii's own 99.9%"),
    ("Medical record storage", "HiX is the record of truth; the Belgian 30-year retention duty lives there. ZAS keeps ~5 years of operational data, so storage plateaus"),
    ("Patient app hosting", "native app via App Store / Play Store; no patient-facing web to host"),
    ("People", "on-call rota for 99.9%, ops time, NIS2 compliance work — salary money, likely exceeds this entire cloud bill"),
    ("Vendor licences & audits", "Luscii, ChipSoft/HiX, pen-tests, ISO 27001 / NEN 7510 certification"),
]

PROVIDER_NOTES = {
    "GCP": {
        "pitch": "Only big-3 provider with a Belgian region (europe-west1, St. Ghislain) — data on Belgian soil without contortions. Also the cheapest column at every tier.",
        "arch": {"lb": "External HTTPS LB", "runtime": "Cloud Run (CPU always-allocated)", "db": "Cloud SQL PostgreSQL · regional HA", "obj": "Cloud Storage (GCS)", "vm": "Compute Engine n2-standard",
                 "platform": [("Secret Manager", "DB creds, Luscii/HiX tokens"), ("Artifact Registry", "container images"), ("Cloud Logging + Monitoring", "logs, metrics, alerting, uptime checks"), ("Cloud DNS + managed certs", "zone + auto-renewing TLS")]},
        "compute_options": [
            ("Cloud Run", "chosen", "containers as-is, min-instances + CPU always-allocated handles SSE and the worker's timers; scales per revision; no cluster to run"),
            ("Cloud Functions", "rejected", "request-scoped, times out — no long-lived SSE connections, no always-on pathway worker"),
            ("GKE (Kubernetes)", "rejected", "cluster ops (upgrades, node pools, RBAC) for 3 workloads — overhead without payoff at this scale"),
            ("Compute Engine VMs", "shape A", "the VM + compose variant: same containers under docker compose on n2-standard instances"),
        ],
        "network": [
            "VPC in europe-west1, resources spread over ≥2 zones (Cloud SQL regional HA does the zone-failover)",
            "Cloud Run reaches Cloud SQL over private IP (VPC egress / connector) — DB has no public address",
            "GCS access via IAM + presigned URLs; no NAT needed for Cloud Run (managed egress) — small Cloud NAT only for the VM shape",
            "Deploy path: image → Artifact Registry → new Cloud Run revision (gradual rollout, instant rollback)",
        ],
        "mapping": [
            ("PostgreSQL HA", "Cloud SQL for PostgreSQL, Enterprise, regional (HA)", "automatic failover across zones; storage billed 2× for the standby"),
            ("Backend / worker / Keycloak", "Cloud Run, CPU always-allocated", "always-allocated because of SSE and the worker's timers — no cold starts, no scale-to-zero"),
            ("Object storage", "Cloud Storage (GCS), Standard, single-region", "europe-west1 keeps attachments on Belgian soil too"),
            ("Load balancer", "External HTTPS LB", "cheapest LB of the three (~€16/mo)"),
            ("VM shape", "Compute Engine n2-standard", "listed prices include the automatic 20% sustained-use discount"),
        ],
    },
    "Azure": {
        "pitch": "No Belgian region — France Central is the nearest fit. Strong card if the hospital is a Microsoft shop (EA agreements, Entra, ops skills); otherwise the most expensive column (~30% over GCP, mostly DB compute).",
        "arch": {"lb": "Application Gateway Basic v2", "runtime": "Container Apps (always-active)", "db": "PostgreSQL Flexible Server · zone-redundant HA", "obj": "Blob Storage (Hot LRS)", "vm": "D-series v5 VMs",
                 "platform": [("Key Vault", "DB creds, Luscii/HiX tokens"), ("Container Registry (Basic)", "container images"), ("Azure Monitor / Log Analytics", "logs, metrics, alerting"), ("Azure DNS + managed certs", "zone + TLS")]},
        "compute_options": [
            ("Container Apps", "chosen", "managed K8s underneath (KEDA/Envoy) without cluster ops; min-replicas ≥ 1 pins instances for SSE and the worker"),
            ("Azure Functions", "rejected", "request/trigger-scoped — no long-lived SSE, no always-on worker loop"),
            ("AKS (Kubernetes)", "rejected", "full cluster ops for 3 workloads — not worth it at this scale"),
            ("App Service", "considered", "works for the API, but worker + Keycloak fit Container Apps' container model better; one runtime for all three"),
            ("D-series VMs", "shape A", "the VM + compose variant"),
        ],
        "network": [
            "VNet in France Central, zone-redundant setup across availability zones",
            "Container Apps environment VNet-integrated; PostgreSQL Flexible Server via private endpoint — no public DB address",
            "NAT Gateway for controlled outbound (Luscii/HiX calls from a stable IP)",
            "Deploy path: image → ACR → Container Apps revision (traffic-split rollout)",
        ],
        "mapping": [
            ("PostgreSQL HA", "Azure Database for PostgreSQL Flexible Server, zone-redundant HA", "standby doubles both compute and storage billing"),
            ("Backend / worker / Keycloak", "Container Apps, consumption plan, always-active", "min-replicas ≥ 1 pinned for SSE; dedicated plan's ~€64/mo environment fee not needed at this scale"),
            ("Object storage", "Blob Storage, Hot LRS", "not S3-compatible — MVP's storage abstraction (planned anyway) makes it first-class"),
            ("Load balancer", "Application Gateway Basic v2", "Standard_v2 (~€165/mo) only needed for WAF/high scale"),
            ("VM shape", "D-series v5 VMs", "pay-as-you-go; 1-yr reservation cuts ~38%"),
        ],
    },
    "AWS": {
        "pitch": "No Belgian region — eu-west-3 Paris. Broadest ecosystem and the PoC demo already runs here (CDK). Big lines (EC2, RDS Multi-AZ, S3) verified against AWS's own pricing feed on 2026-08-07; small lines (Fargate, EBS, egress) are ±10% estimates.",
        "arch": {"lb": "Application Load Balancer", "runtime": "ECS Fargate", "db": "RDS PostgreSQL · Multi-AZ", "obj": "S3 Standard", "vm": "EC2 m6i",
                 "platform": [("Secrets Manager / SSM", "DB creds, Luscii/HiX tokens"), ("ECR", "container images"), ("CloudWatch", "logs, metrics, alarms"), ("Route 53 + ACM", "DNS + auto-renewing TLS")]},
        "compute_options": [
            ("ECS Fargate", "chosen", "containers as-is, no servers to patch; long-running tasks handle SSE connections and the worker's timer loop; per-service auto-scaling"),
            ("Lambda", "rejected", "request-scoped, 15-min max — cannot hold SSE connections open, cannot run the always-on pathway worker; would force an architecture rewrite"),
            ("EKS (Kubernetes)", "rejected", "cluster fee + node/upgrade ops for 3 workloads — complexity without payoff at this scale"),
            ("EC2 + compose", "shape A", "the VM + compose variant: same containers, self-managed on m6i instances"),
        ],
        "network": [
            "VPC across 2 AZs: public subnets (ALB only) · private app subnets (Fargate tasks) · isolated DB subnets (RDS)",
            "NAT gateway for outbound calls (Luscii/HiX) from private subnets; S3 via free gateway endpoint",
            "Security groups chain: ALB → app tasks → RDS; nothing but the ALB is internet-reachable",
            "Deploy path: image → ECR → ECS rolling deploy (CDK already does this for the PoC demo)",
        ],
        "mapping": [
            ("PostgreSQL HA", "RDS for PostgreSQL, Multi-AZ", "synchronous standby in second AZ; storage billed 2×"),
            ("Backend / worker / Keycloak", "ECS Fargate", "long-lived tasks suit SSE; per-vCPU/GB-hour pricing"),
            ("Object storage", "S3 Standard", "drop-in for the PoC's boto3 client"),
            ("Load balancer", "Application Load Balancer", "base + LCU; supports long idle timeouts for SSE"),
            ("VM shape", "EC2 m6i instances", "1-yr Compute Savings Plan cuts ~27%"),
        ],
    },
}


def load_prices():
    out = {}
    for f in sorted(DATA.glob("prices.*.json")):
        d = json.loads(f.read_text())
        out[d["provider"]] = d
    return out


def shared_lines(p, t):
    u = p["unit_prices"]
    egress_billable = max(0, t["egress_gb"] - u["egress_free_gb"])
    return [
        ("Object storage (attachments)", t["obj_gb"] * u["obj_gb"], f"{t['obj_gb']} GB"),
        ("Private networking", u["nat_month"], "NAT / private endpoints"),
        ("Egress", egress_billable * u["egress_gb"], f"{t['egress_gb']} GB/mo ({u['egress_free_gb']} free)"),
        ("Monitoring / logging", u["monitoring_month"], "~20 GB logs + alerts"),
        ("Container registry", u["registry_month"], ""),
        ("DNS", u["dns_month"], "1 zone"),
    ]


def shape_managed(p, t):
    u = p["unit_prices"]
    lines = [
        ("Managed PostgreSQL (HA)", u[t["db_sku"]], t["db_sku"].replace("pg_", "").replace("_ha", "").replace("x", " vCPU / ") + " GB, multi-AZ"),
        ("DB storage (HA)", t["db_gb"] * u["pg_storage_gb_ha"], f"{t['db_gb']} GB"),
        ("DB backups", t["db_gb"] * u["pg_backup_gb"], "~1x DB size"),
    ]
    for name, (n, vcpu, gb) in t["containers"].items():
        cost = n * (vcpu * u["ct_vcpu_hr"] + gb * u["ct_gb_hr"]) * H
        lines.append((f"{name} ×{n}", cost, f"{vcpu} vCPU / {gb} GB each, always-on"))
    lines.append(("Load balancer", u["lb_month"], ""))
    return lines + shared_lines(p, t)


def shape_vm(p, t):
    u = p["unit_prices"]
    lines = []
    for sku, n in t["vm_app"]:
        lines.append((f"App VM ×{n}", n * u[sku], sku.replace("vm_", "").replace("x", " vCPU / ") + " GB — compose: backend+worker+keycloak+nginx"))
    for sku, n in t["vm_db"]:
        lines.append((f"DB VM ×{n}", n * u[sku], "self-managed PG, primary + standby (2 zones)"))
    lines.append(("Block storage", t["vm_disk_gb"] * u["disk_gb"], f"{t['vm_disk_gb']} GB SSD"))
    lines.append(("Snapshots/backups", t["vm_snap_gb"] * u["snapshot_gb"], f"~{t['vm_snap_gb']} GB"))
    if t["vm_lb"]:
        lines.append(("Load balancer", u["lb_month"], "multi-VM app tier"))
    return lines + shared_lines(p, t)


def totals(lines, u):
    prod = sum(c for _, c, _ in lines)
    dev_demo = u["vm_2x8"] + 50 * u["disk_gb"]
    total = prod * (1 + STAGING_RATIO) + dev_demo
    return prod, dev_demo, total


def compute():
    prices = load_prices()
    result = {}
    for prov, p in prices.items():
        u = p["unit_prices"]
        result[prov] = {"meta": p, "tiers": {}}
        for tier, t in TIERS.items():
            cells = {}
            for shape, fn in (("managed", shape_managed), ("vm", shape_vm)):
                lines = fn(p, t)
                prod, dev, total = totals(lines, u)
                cells[shape] = {
                    "lines": lines, "prod": prod, "dev_demo": dev,
                    "total_month": total, "total_year": total * 12,
                    "commit_note": f"~{(u['commit_1yr_pct_compute'] + u['commit_1yr_pct_db']) // 2}% off compute/DB w/ 1-yr commit",
                }
            result[prov]["tiers"][tier] = cells
    return result


# ---------------------------------------------------------------- html
CSS = """
:root{--teal:#159488;--teal-dark:#0c6b62;--ink:#12332f;--muted:#5b7470;--bg:#f6faf9;--card:#fff;--line:#dcebe8;--warn:#b45309;
--gcp:#159488;--azure:#3c7fb8;--aws:#d09a3c}
*{box-sizing:border-box;margin:0}body{font:15px/1.55 -apple-system,'Segoe UI',sans-serif;color:var(--ink);background:var(--bg);padding:0 0 80px}
.wrap{max-width:1080px;margin:0 auto;padding:0 28px}
header{background:linear-gradient(135deg,var(--teal-dark),var(--teal));color:#fff;padding:40px 0 0}
header h1{font-size:29px;letter-spacing:-.02em}header p{opacity:.88;margin-top:6px;max-width:74ch}
.badge{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);border-radius:99px;padding:2px 12px;font-size:12px;margin:12px 6px 0 0}
.tabs{display:flex;gap:6px;margin-top:26px}
.tab{appearance:none;border:0;background:rgba(255,255,255,.14);font:600 14.5px/1 inherit;color:#fff;padding:13px 26px;cursor:pointer;border-radius:10px 10px 0 0;opacity:.75}
.tab.active{background:var(--bg);color:var(--ink);opacity:1}
.tab .dot{display:inline-block;width:9px;height:9px;border-radius:99px;margin-right:8px;background:#fff}
.panel{display:none}.panel.active{display:block}
h2{font-size:21px;margin:38px 0 6px;letter-spacing:-.01em}h3{font-size:16.5px;margin:24px 0 8px}
.sub{color:var(--muted);font-size:13.5px;margin-bottom:14px;max-width:80ch}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px 22px;margin:14px 0}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:7px 10px;border-bottom:2px solid var(--line)}
td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.total td{font-weight:700;background:#eef7f5}
.pill{font-size:11px;border-radius:99px;padding:1px 9px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.warn{color:var(--warn);font-weight:600}
.matrix td.hero{font-weight:700;font-size:15px;color:var(--teal-dark)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.note{background:#fdf6ec;border:1px solid #f1dfc0;border-radius:10px;padding:12px 16px;font-size:13.5px;margin:14px 0}
.svc{display:grid;grid-template-columns:230px 1fr;gap:0 22px;padding:15px 0;border-bottom:1px solid var(--line)}
.svc:last-child{border-bottom:0}.svc h4{font-size:15px;margin-bottom:2px}
.svc .scale{font-size:12px;color:var(--teal-dark);margin-top:4px}
.svc p{font-size:13.5px;margin-top:6px}.svc p:first-of-type{margin-top:0}
.arch{display:grid;gap:10px;margin:8px 0}
.arow{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.abox{flex:1;min-width:150px;border:1.5px solid var(--line);border-radius:10px;padding:10px 14px;background:#fbfdfd;font-size:13px}
.abox b{display:block;font-size:13.5px}.abox span{color:var(--muted);font-size:12px}
.abox.hl{border-color:var(--teal);background:#f0faf8}
.abox.ext{border-style:dashed;background:transparent}
.alabel{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:2px 2px -4px}
.arrow{text-align:center;color:var(--muted);font-size:15px;line-height:.6;margin:-2px 0}
.bar-note{font-size:11px;fill:var(--muted)}
footer{margin-top:56px;color:var(--muted);font-size:12.5px}
@media(max-width:840px){.grid2{grid-template-columns:1fr}.svc{grid-template-columns:1fr}.tabs{flex-wrap:wrap}}
"""

JS = """
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  document.getElementById('panel-'+b.dataset.p).classList.add('active');
  window.scrollTo({top:0});
}));
"""


def eur(x):
    return f"€{x:,.0f}"


def arch_diagram(prov, notes):
    ar = notes["arch"]
    platform = "".join(
        f"<div class='abox'><b>{name}</b><span>{why}</span></div>" for name, why in ar["platform"]
    )
    return (
        "<div class='arch'>"
        "<div class='alabel'>Clients</div>"
        "<div class='arow'><div class='abox ext'><b>Caregiver SPA</b><span>orchestrator, served via LB</span></div>"
        "<div class='abox ext'><b>Patient app</b><span>native, app stores — hits the API only</span></div></div>"
        "<div class='arrow'>▼</div>"
        "<div class='alabel'>Edge — public, the only internet-reachable layer</div>"
        f"<div class='arow'><div class='abox hl'><b>{ar['lb']}</b><span>TLS · host routing · SSE idle timeouts</span></div></div>"
        "<div class='arrow'>▼</div>"
        f"<div class='alabel'>Application — {ar['runtime']} · private network · ≥2 zones</div>"
        "<div class='arow'>"
        "<div class='abox hl'><b>Backend API</b><span>REST + SSE · always-on replicas</span></div>"
        "<div class='abox hl'><b>Worker</b><span>custom pathway engine · timers/retries</span></div>"
        "<div class='abox hl'><b>Keycloak</b><span>identity · eHealth OIDC broker</span></div>"
        "</div>"
        "<div class='arrow'>▼</div>"
        "<div class='alabel'>Data — private, no public addresses</div>"
        "<div class='arow'>"
        f"<div class='abox hl'><b>{ar['db']}</b><span>pathway state · tasks · audit · identity — PITR, standby</span></div>"
        f"<div class='abox hl'><b>{ar['obj']}</b><span>attachments via presigned URLs</span></div>"
        "</div>"
        "<div class='alabel' style='margin-top:6px'>Platform services</div>"
        f"<div class='arow'>{platform}</div>"
        "<div class='alabel' style='margin-top:6px'>External (not on this bill)</div>"
        "<div class='arow'>"
        "<div class='abox ext'><b>Luscii</b><span>video · messaging · questionnaires (their infra)</span></div>"
        "<div class='abox ext'><b>HiX</b><span>record of truth · VPN or mediated API (open)</span></div>"
        "<div class='abox ext'><b>eHealth OIDC</b><span>upstream identity provider</span></div>"
        "</div></div>"
    )


def render(result):
    tab_order = ["Summary", "AWS", "Azure", "GCP"]
    colors = {"GCP": "var(--gcp)", "Azure": "var(--azure)", "AWS": "var(--aws)", "Summary": "#fff"}
    hex_ = {"GCP": "#159488", "Azure": "#3c7fb8", "AWS": "#d09a3c"}
    provs = ["GCP", "Azure", "AWS"]
    o = []
    a = o.append
    a(f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>ZAS platform — hosting cost breakdown</title><style>{CSS}</style></head><body>")
    a("<header><div class='wrap'><h1>ZAS platform — hosting cost breakdown</h1>"
      "<p>What we need to host, why, and what it costs — three providers, two deployment shapes, three growth projections. Pure hosting: excludes personnel/on-call, vendor licences (Luscii, ChipSoft), audits, app-store fees.</p>"
      "<span class='badge'>±30% list-price ballpark</span><span class='badge'>EU regions: Belgium / France</span><span class='badge'>99.9% SLA · multi-AZ from MVP</span><span class='badge'>2026-08-06</span>")
    a("<div class='tabs'>")
    for i, tab in enumerate(tab_order):
        act = " active" if i == 0 else ""
        dot = f"<span class='dot' style='background:{hex_.get(tab, '#fff')}'></span>" if tab != "Summary" else ""
        a(f"<button class='tab{act}' data-p='{tab}'>{dot}{tab}</button>")
    a("</div></div></header><div class='wrap'>")

    # ================= SUMMARY TAB =================
    a("<div class='panel active' id='panel-Summary'>")
    a("<h2>Total monthly cost — all environments</h2>")
    a("<p class='sub'>Prod (sized at tier, 99.9% posture) + staging (25% of prod) + always-on dev/demo VM. Yearly in smaller print.</p>")
    a("<div class='card matrix'><table><tr><th></th>")
    for tier, t in TIERS.items():
        a(f"<th class='num'>{t['label']}<br><span style='font-weight:400;text-transform:none'>{t['given']}</span></th>")
    a("</tr>")
    for prov in provs:
        for shape, lbl in (("managed", "managed services"), ("vm", "VM + compose")):
            flag = " <span class='warn'>*</span>" if not result[prov]["meta"]["verified"] else ""
            a(f"<tr><td><span style='display:inline-block;width:9px;height:9px;border-radius:99px;background:{hex_[prov]};margin-right:8px'></span><b>{prov}</b>{flag} · {lbl}</td>")
            for tier in TIERS:
                c = result[prov]["tiers"][tier][shape]
                a(f"<td class='num hero'>{eur(c['total_month'])}/mo<br><span style='font-weight:400;font-size:12px;color:var(--muted)'>{eur(c['total_year'])}/yr</span></td>")
            a("</tr>")
    a("</table></div>")
    a("<p class='sub'>All three providers source-verified on the big lines (compute, HA database, object storage): Azure via retail-prices API, AWS via its pricing feed (2026-08-07), GCP via pricing pages. Small lines ±10%.</p>")

    a("<div class='card'>")
    maxv = max(result[p]["tiers"][t]["managed"]["total_month"] for p in provs for t in TIERS)
    bw, gap, gh = 84, 30, 200
    cw = len(TIERS) * (len(provs) * bw + gap * 2 + 40) + 40
    a(f"<svg viewBox='0 0 {cw} {gh + 70}' width='100%' role='img'>")
    x = 40
    for tier in TIERS:
        for prov in provs:
            v = result[prov]["tiers"][tier]["managed"]["total_month"]
            h = v / maxv * gh
            a(f"<rect x='{x}' y='{gh - h + 20}' width='{bw - 8}' height='{h}' rx='4' fill='{hex_[prov]}'/>")
            a(f"<text x='{x + bw / 2 - 4}' y='{gh - h + 12}' text-anchor='middle' class='bar-note'>{eur(v)}</text>")
            a(f"<text x='{x + bw / 2 - 4}' y='{gh + 36}' text-anchor='middle' class='bar-note'>{prov}</text>")
            x += bw
        a(f"<text x='{x - (len(provs) * bw) / 2}' y='{gh + 56}' text-anchor='middle' class='bar-note' font-weight='700'>{tier}</text>")
        x += gap * 2 + 40
    a("</svg><p class='sub'>Monthly totals, managed shape. VM + compose runs ~25–35% below these bars.</p></div>")

    a("<h2>The services we need — and why</h2>")
    a("<p class='sub'>Platform architecture after the MVP stack decisions (custom pathway engine instead of Temporal, Keycloak instead of Ory, native object storage instead of MinIO). Six components plus cross-cutting basics — that's the whole bill. Provider tabs show how each maps onto concrete services.</p>")
    a("<div class='card'>")
    for title, what, why, scales in SERVICES:
        a(f"<div class='svc'><div><h4>{title}</h4><div class='scale'>scales with: {scales}</div></div>"
          f"<div><p>{what}</p><p><b>Why this way:</b> {why}</p></div></div>")
    a("</div>")

    a("<h3>Deliberately <em>not</em> on this bill</h3><div class='card'><table>")
    for item, why in NOT_ON_BILL:
        a(f"<tr><td style='width:240px'><b>{item}</b></td><td>{why}</td></tr>")
    a("</table></div>")

    a("<h3>Assumptions & remaining unknowns</h3>")
    a("<div class='note'><b>Load assumptions (derived, ±2× tolerated):</b> peak 100/150/300 req/s sizing (sustained ~35/50/100) · DB 75 GB/350 GB/2 TB · attachments 250 GB/1.2 TB/8 TB (~10 MB per pathway patient) · egress 250/750/3000 GB/mo. Combined worst-case swing ≈ ±€500/mo at 2036 — inside the ±30% band. The expensive lines (HA database, always-on compute) hang off the confirmed projection numbers, not these estimates.</div>")
    a("<div class='card'><table>"
      "<tr><td style='width:280px'><b>HiX connection shape</b></td><td>VPN vs mediated API — adds/removes a VPN line (≈ €30–120/mo, priced in each provider tab)</td></tr>"
      "<tr><td><b>AWS verification</b></td><td>one research pass replaces the estimated tab with sourced prices</td></tr>"
      "<tr><td><b>Temporal add-on</b></td><td>if the custom engine is ever replaced: ~€100–200/mo at MVP scale, growing with open enrollments</td></tr>"
      "</table></div>")
    a("</div>")  # /Summary

    # ================= PROVIDER TABS =================
    for prov in ["AWS", "Azure", "GCP"]:
        meta, notes = result[prov]["meta"], PROVIDER_NOTES[prov]
        a(f"<div class='panel' id='panel-{prov}'>")
        ver = "" if meta["verified"] else "<div class='note'><b>Unverified:</b> this tab uses model-knowledge price estimates — verify against official pricing before external use.</div>"
        a(f"<h2>{prov} · {meta['region']}</h2><p class='sub'>{notes['pitch']}</p>{ver}")

        a("<h3>Compute: where do the containers run?</h3>")
        a("<div class='card'><table><tr><th>Option</th><th style='width:110px'>Verdict</th><th>Why</th></tr>")
        for opt, verdict, why in notes["compute_options"]:
            style = {"chosen": "color:var(--teal-dark);font-weight:700", "shape A": "color:var(--muted);font-weight:600"}.get(verdict, "color:var(--warn);font-weight:600")
            a(f"<tr><td style='width:170px'><b>{opt}</b></td><td><span style='{style}'>{verdict}</span></td><td>{why}</td></tr>")
        a("</table></div>")

        a("<h3>Architecture on this provider</h3><div class='card'>")
        a(arch_diagram(prov, notes))
        a("</div>")

        a("<h3>Network layout & deploy path</h3><div class='card'><table>")
        for line in notes["network"]:
            a(f"<tr><td>{line}</td></tr>")
        a("</table></div>")

        a("<h3>Service choices</h3><div class='card'><table><tr><th>Need</th><th>Service</th><th>Why</th></tr>")
        for need, svc, why in notes["mapping"]:
            a(f"<tr><td style='width:190px'><b>{need}</b></td><td style='width:280px'>{svc}</td><td>{why}</td></tr>")
        a("</table></div>")

        a("<h3>Costs per item, per phase</h3>")
        a("<p class='sub'>Production line items; totals add staging (25%) + dev/demo. Managed services vs VM + compose side by side.</p>")
        for tier in TIERS:
            a(f"<div class='card'><b>{TIERS[tier]['label']}</b> <span class='pill'>{TIERS[tier]['given']}</span><div class='grid2' style='margin-top:10px'>")
            for shape, lbl in (("managed", "Managed services"), ("vm", "VM + compose")):
                c = result[prov]["tiers"][tier][shape]
                a(f"<div><table><tr><th>{lbl}</th><th class='num'>EUR/mo</th></tr>")
                for name, cost, note in c["lines"]:
                    n = f" <span class='pill'>{note}</span>" if note else ""
                    a(f"<tr><td>{name}{n}</td><td class='num'>{eur(cost)}</td></tr>")
                a(f"<tr><td>Production subtotal</td><td class='num'>{eur(c['prod'])}</td></tr>")
                a(f"<tr><td>+ staging 25% + dev/demo</td><td class='num'>{eur(c['prod'] * STAGING_RATIO + c['dev_demo'])}</td></tr>")
                a(f"<tr class='total'><td>Total <span class='pill'>{c['commit_note']}</span></td><td class='num'>{eur(c['total_month'])}/mo · {eur(c['total_year'])}/yr</td></tr>")
                a("</table></div>")
            a("</div></div>")

        u = meta["unit_prices"]
        a(f"<div class='note'><b>Optional:</b> site-to-site VPN to the hospital for HiX ≈ {eur(u['vpn_month'])}/mo "
          f"(only if HiX needs VPN instead of a mediated API — open question). "
          f"1-yr commitment cuts ~{u['commit_1yr_pct_compute']}% off compute and ~{u['commit_1yr_pct_db']}% off DB vs these on-demand figures.</div>")
        a("</div>")

    a("<footer>Generated by <code>docs/hosting-costs/calc.py</code> from <code>data/needs.yaml</code> + <code>data/prices.*.json</code> — edit data, re-run, numbers update. "
      "Sources &amp; retrieval dates inside the price files. List prices, on-demand, no negotiated discounts; excludes personnel, licences, audits.</footer>")
    a(f"</div><script>{JS}</script></body></html>")
    return "".join(o)


def main():
    result = compute()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(render(result))
    print(f"wrote {OUT}")
    for prov in result:
        for tier in TIERS:
            c = result[prov]["tiers"][tier]
            print(f"{prov:6} {tier}  managed {eur(c['managed']['total_month']):>8}/mo   vm {eur(c['vm']['total_month']):>8}/mo")


if __name__ == "__main__":
    main()
