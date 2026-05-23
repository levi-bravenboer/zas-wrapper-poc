# POC ONLY — hard-coded synthetic Luscii programs.
# Replaced by a live fetch + cache layer in the future live-Luscii adapter
# change. Until then this constant is the only source of program payloads
# served by `GET /luscii/programs` and `GET /luscii/programs/{id}`.

"""Synthetic Luscii program payloads served by the stub adapter.

Static in-memory registry — no DB table backing it. Routes that need
Luscii programs (e.g. the picker `GET /luscii/programs` and the
per-id resolve `GET /luscii/programs/{id}`) read from this constant.

All synthetic — no real patient data, no real Luscii ids. Naming pattern
``luscii-<kebab-slug>-v<n>`` mirrors how live Luscii ids look without
colliding with anything actually published by Luscii.

Each payload validates against :class:`app.adapters.luscii.program.LusciiProgramData`
at module import; the unit test :mod:`tests.adapters.test_luscii_programs`
enforces this.

When the live Luscii adapter lands, this constant is replaced by a real
fetch + cache layer; the routes' response shape stays unchanged.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.adapters.luscii.program import (
    LusciiAlertThreshold,
    LusciiInstrument,
    LusciiLayout,
    LusciiLayoutEdge,
    LusciiLayoutLane,
    LusciiLayoutNode,
    LusciiLayoutPhase,
    LusciiProgramData,
    LusciiProtocol,
)


def _phase(id: str, ord: int, label: str) -> LusciiLayoutPhase:
    return LusciiLayoutPhase(id=id, ord=ord, label=label)


def _lane(id: str, ord: int, kind: str) -> LusciiLayoutLane:
    return LusciiLayoutLane(id=id, ord=ord, kind=kind)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# 1. Hartfalen thuismonitoring — 12w, 3 protocols, 4 instruments
# ---------------------------------------------------------------------------

_HARTFALEN = LusciiProgramData(
    id="luscii-hartfalen-monitoring-v4",
    name="Hartfalen thuismonitoring",
    description="Daily monitoring for chronic heart failure with weekly KCCQ.",
    version="v4.2",
    version_published_at=datetime(2026, 5, 8, tzinfo=timezone.utc),
    is_two_way_messaging=True,
    enrolled_count_org_wide=248,
    protocols=[
        LusciiProtocol(
            id="proto-std-12w",
            name="Standaard 12 weken",
            duration_weeks=12,
            reminder_cadence="daily 09:00",
            overdue_hours=48,
            is_default=True,
        ),
        LusciiProtocol(
            id="proto-intensief-16w",
            name="Intensief 16 weken",
            duration_weeks=16,
            reminder_cadence="twice daily",
            overdue_hours=24,
        ),
        LusciiProtocol(
            id="proto-light-8w",
            name="Light 8 weken",
            duration_weeks=8,
            reminder_cadence="weekly",
            overdue_hours=168,
        ),
    ],
    instruments=[
        LusciiInstrument(code="bp", label="Bloeddruk", cadence="1×/dag", icon="heart-pulse"),
        LusciiInstrument(code="weight", label="Gewicht", cadence="1×/dag", icon="scale"),
        LusciiInstrument(code="spo2", label="Saturatie", cadence="1×/dag", icon="droplets"),
        LusciiInstrument(code="kccq", label="KCCQ", cadence="1×/week", icon="clipboard-list"),
    ],
    alert_thresholds=[
        LusciiAlertThreshold(label="Syst. BP", rule="< 90 of > 180"),
        LusciiAlertThreshold(label="Gewichtstoename", rule="≥ 2 kg / 48u"),
        LusciiAlertThreshold(label="Inactiviteit", rule="≥ 3 dagen geen meting"),
    ],
    care_network="Cardioloog + monitoring-verpleegkundige · escalatie naar SEH bij prio HIGH",
    layout=LusciiLayout(
        phases=[
            _phase("p1", 0, "Onboarding"),
            _phase("p2", 1, "Pre-op"),
            _phase("p3", 2, "Monitor"),
            _phase("p4", 3, "Close-out"),
        ],
        lanes=[
            _lane("l1", 0, "patient"),
            _lane("l2", 1, "caregiver"),
            _lane("l3", 2, "external"),
            _lane("l4", 3, "system"),
        ],
        nodes=[
            LusciiLayoutNode(
                id="n1", phase_id="p1", lane_id="l4", x=70, y=26,
                label="Welkomstmail", type="message", timing_label="D0", is_entry=True,
            ),
            LusciiLayoutNode(
                id="n2", phase_id="p2", lane_id="l1", x=70, y=26,
                label="Intake-vragenlijst", type="form", timing_label="D1",
            ),
            LusciiLayoutNode(
                id="n3", phase_id="p2", lane_id="l2", x=70, y=26,
                label="Telefonische intake", type="appointment", timing_label="D2",
            ),
            LusciiLayoutNode(
                id="n4", phase_id="p3", lane_id="l1", x=70, y=26,
                label="Bloeddruk meting", type="measurement", timing_label="W1-12 · 1×/dag",
            ),
            LusciiLayoutNode(
                id="n5", phase_id="p3", lane_id="l3", x=70, y=26,
                label="KCCQ wekelijks", type="questionnaire", timing_label="W1-12 · 1×/wk",
            ),
            LusciiLayoutNode(
                id="n6", phase_id="p3", lane_id="l2", x=70, y=26,
                label="Review alerts", type="task", timing_label="async · ≥ med",
            ),
            LusciiLayoutNode(
                id="n7", phase_id="p4", lane_id="l1", x=70, y=26,
                label="Monitoring afgerond", type="milestone", timing_label="W12",
            ),
        ],
        edges=[
            LusciiLayoutEdge(id="e1", source="n1", target="n2"),
            LusciiLayoutEdge(id="e2", source="n2", target="n3"),
            LusciiLayoutEdge(id="e3", source="n3", target="n4"),
            LusciiLayoutEdge(id="e4", source="n3", target="n5"),
            LusciiLayoutEdge(id="e5", source="n5", target="n6"),
            LusciiLayoutEdge(id="e6", source="n4", target="n7"),
        ],
    ),
)


# ---------------------------------------------------------------------------
# 2. COPD self-management — 16w, 2 protocols, 3 instruments
# ---------------------------------------------------------------------------

_COPD = LusciiProgramData(
    id="luscii-copd-self-management-v2",
    name="COPD self-management",
    description="CAT-questionnaire weekly, FEV1 trends from connected spirometer, exacerbation symptom triage.",
    version="v2.1",
    version_published_at=datetime(2026, 4, 14, tzinfo=timezone.utc),
    is_two_way_messaging=False,
    enrolled_count_org_wide=87,
    protocols=[
        LusciiProtocol(
            id="proto-copd-std-16w",
            name="Standaard 16 weken",
            duration_weeks=16,
            reminder_cadence="daily 08:00",
            overdue_hours=48,
            is_default=True,
        ),
        LusciiProtocol(
            id="proto-copd-stable-26w",
            name="Stabiel 26 weken",
            duration_weeks=26,
            reminder_cadence="weekly Monday",
            overdue_hours=168,
        ),
    ],
    instruments=[
        LusciiInstrument(code="cat", label="CAT", cadence="1×/week", icon="clipboard-list"),
        LusciiInstrument(code="fev1", label="FEV1", cadence="1×/dag", icon="activity"),
        LusciiInstrument(code="symptom_log", label="Symptomen", cadence="bij verandering", icon="message-square"),
    ],
    alert_thresholds=[
        LusciiAlertThreshold(label="CAT-score", rule="≥ 10 punten stijging"),
        LusciiAlertThreshold(label="FEV1 daling", rule="≥ 15% versus baseline"),
    ],
    care_network="Longarts + COPD-verpleegkundige",
    layout=LusciiLayout(
        phases=[
            _phase("p1", 0, "Intake"),
            _phase("p2", 1, "Stabiel"),
            _phase("p3", 2, "Exacerbatie-triage"),
        ],
        lanes=[
            _lane("l1", 0, "patient"),
            _lane("l2", 1, "caregiver"),
            _lane("l3", 2, "external"),
        ],
        nodes=[
            LusciiLayoutNode(
                id="n1", phase_id="p1", lane_id="l1", x=70, y=26,
                label="Baseline CAT", type="form", timing_label="D0", is_entry=True,
            ),
            LusciiLayoutNode(
                id="n2", phase_id="p1", lane_id="l2", x=70, y=26,
                label="Spirometer-uitleg", type="appointment", timing_label="D1",
            ),
            LusciiLayoutNode(
                id="n3", phase_id="p2", lane_id="l3", x=70, y=26,
                label="FEV1 dagelijks", type="measurement", timing_label="W1-16 · 1×/dag",
            ),
            LusciiLayoutNode(
                id="n4", phase_id="p2", lane_id="l1", x=70, y=26,
                label="CAT wekelijks", type="questionnaire", timing_label="W1-16 · 1×/wk",
            ),
            LusciiLayoutNode(
                id="n5", phase_id="p3", lane_id="l2", x=70, y=26,
                label="Triage-call", type="task", timing_label="bij alert",
            ),
        ],
        edges=[
            LusciiLayoutEdge(id="e1", source="n1", target="n2"),
            LusciiLayoutEdge(id="e2", source="n2", target="n3"),
            LusciiLayoutEdge(id="e3", source="n2", target="n4"),
            LusciiLayoutEdge(id="e4", source="n3", target="n5"),
        ],
    ),
)


# ---------------------------------------------------------------------------
# 3. Diabetes type 2 coaching — 24w, 2 protocols, 4 instruments
# ---------------------------------------------------------------------------

_DIABETES = LusciiProgramData(
    id="luscii-diabetes-coaching-v6",
    name="Diabetes type 2 coaching",
    description="Bloedglucose tracking, voeding-logs, medicatie-adherence, coaching content over 24 weken.",
    version="v6.0",
    version_published_at=datetime(2026, 3, 2, tzinfo=timezone.utc),
    is_two_way_messaging=True,
    enrolled_count_org_wide=412,
    protocols=[
        LusciiProtocol(
            id="proto-dm2-std-24w",
            name="Standaard 24 weken",
            duration_weeks=24,
            reminder_cadence="daily 07:30",
            overdue_hours=24,
            is_default=True,
        ),
        LusciiProtocol(
            id="proto-dm2-intensief-12w",
            name="Intensief 12 weken",
            duration_weeks=12,
            reminder_cadence="3× daily",
            overdue_hours=12,
        ),
    ],
    instruments=[
        LusciiInstrument(code="glucose", label="Bloedglucose", cadence="2×/dag", icon="droplet"),
        LusciiInstrument(code="meal_log", label="Voeding-log", cadence="3×/dag", icon="utensils"),
        LusciiInstrument(code="med_adherence", label="Medicatie", cadence="dagelijks", icon="pill"),
        LusciiInstrument(code="hba1c", label="HbA1c", cadence="elke 12w", icon="flask-conical"),
    ],
    alert_thresholds=[
        LusciiAlertThreshold(label="Glucose nuchter", rule="< 4 of > 12 mmol/L"),
        LusciiAlertThreshold(label="Medicatie-miss", rule="≥ 3 dagen geen inname"),
        LusciiAlertThreshold(label="HbA1c", rule="> 64 mmol/mol"),
    ],
    care_network="Internist + diabetesverpleegkundige + diëtist",
    layout=LusciiLayout(
        phases=[
            _phase("p1", 0, "Intake"),
            _phase("p2", 1, "Coaching week 1-12"),
            _phase("p3", 2, "Coaching week 13-24"),
            _phase("p4", 3, "Eind-evaluatie"),
        ],
        lanes=[
            _lane("l1", 0, "patient"),
            _lane("l2", 1, "caregiver"),
            _lane("l3", 2, "external"),
        ],
        nodes=[
            LusciiLayoutNode(
                id="n1", phase_id="p1", lane_id="l2", x=70, y=26,
                label="Intake-gesprek", type="appointment", timing_label="D0", is_entry=True,
            ),
            LusciiLayoutNode(
                id="n2", phase_id="p1", lane_id="l1", x=70, y=26,
                label="Baseline HbA1c", type="measurement", timing_label="D0",
            ),
            LusciiLayoutNode(
                id="n3", phase_id="p2", lane_id="l1", x=70, y=26,
                label="Glucose 2×/dag", type="measurement", timing_label="W1-12",
            ),
            LusciiLayoutNode(
                id="n4", phase_id="p2", lane_id="l3", x=70, y=26,
                label="Educatie-modules", type="education", timing_label="W1-12",
            ),
            LusciiLayoutNode(
                id="n5", phase_id="p2", lane_id="l2", x=70, y=26,
                label="Coaching-check", type="task", timing_label="W4 · W8 · W12",
            ),
            LusciiLayoutNode(
                id="n6", phase_id="p3", lane_id="l1", x=70, y=26,
                label="Glucose 2×/dag", type="measurement", timing_label="W13-24",
            ),
            LusciiLayoutNode(
                id="n7", phase_id="p3", lane_id="l1", x=70, y=26,
                label="Medicatie-log", type="task", timing_label="dagelijks",
            ),
            LusciiLayoutNode(
                id="n8", phase_id="p4", lane_id="l1", x=70, y=26,
                label="HbA1c herhaling", type="measurement", timing_label="W24",
            ),
            LusciiLayoutNode(
                id="n9", phase_id="p4", lane_id="l2", x=70, y=26,
                label="Eind-evaluatie", type="milestone", timing_label="W24",
            ),
        ],
        edges=[
            LusciiLayoutEdge(id="e1", source="n1", target="n2"),
            LusciiLayoutEdge(id="e2", source="n2", target="n3"),
            LusciiLayoutEdge(id="e3", source="n2", target="n4"),
            LusciiLayoutEdge(id="e4", source="n3", target="n5"),
            LusciiLayoutEdge(id="e5", source="n5", target="n6"),
            LusciiLayoutEdge(id="e6", source="n5", target="n7"),
            LusciiLayoutEdge(id="e7", source="n6", target="n8"),
            LusciiLayoutEdge(id="e8", source="n8", target="n9"),
        ],
    ),
)


# ---------------------------------------------------------------------------
# 4. Rugrevalidatie monitoring (pilot) — 8w, 1 protocol, 4 instruments
# ---------------------------------------------------------------------------

_RUGREVALIDATIE = LusciiProgramData(
    id="luscii-rugrevalidatie-monitoring-v0",
    name="Rugrevalidatie monitoring",
    description="ZAS-pilot. Pijnscore (NRS) dagelijks, mobiliteit-oefeningen, PROM (ODI) wekelijks.",
    version="v0.9 beta",
    version_published_at=datetime(2026, 5, 19, tzinfo=timezone.utc),
    is_two_way_messaging=False,
    enrolled_count_org_wide=12,
    protocols=[
        LusciiProtocol(
            id="proto-rug-pilot-8w",
            name="Pilot 8 weken",
            duration_weeks=8,
            reminder_cadence="daily 10:00",
            overdue_hours=48,
            is_default=True,
        ),
    ],
    instruments=[
        LusciiInstrument(code="nrs_pain", label="NRS pijn", cadence="1×/dag", icon="zap"),
        LusciiInstrument(code="mobility", label="Mobiliteit", cadence="2×/week", icon="footprints"),
        LusciiInstrument(code="odi", label="ODI", cadence="1×/week", icon="clipboard-list"),
        LusciiInstrument(code="exercise_log", label="Oefening", cadence="dagelijks", icon="play-circle"),
    ],
    alert_thresholds=[
        LusciiAlertThreshold(label="NRS pijn", rule="≥ 8/10 op 2 opeenvolgende dagen"),
    ],
    care_network="Revalidatiearts + fysiotherapeut · pilot-team",
    layout=LusciiLayout(
        phases=[
            _phase("p1", 0, "Onboarding"),
            _phase("p2", 1, "Actieve revalidatie"),
            _phase("p3", 2, "Eind-meting"),
        ],
        lanes=[
            _lane("l1", 0, "patient"),
            _lane("l2", 1, "caregiver"),
            _lane("l3", 2, "external"),
        ],
        nodes=[
            LusciiLayoutNode(
                id="n1", phase_id="p1", lane_id="l1", x=70, y=26,
                label="Baseline ODI", type="form", timing_label="D0", is_entry=True,
            ),
            LusciiLayoutNode(
                id="n2", phase_id="p2", lane_id="l1", x=70, y=26,
                label="NRS dagelijks", type="measurement", timing_label="W1-8 · 1×/dag",
            ),
            LusciiLayoutNode(
                id="n3", phase_id="p2", lane_id="l3", x=70, y=26,
                label="Oefen-video's", type="education", timing_label="W1-8",
            ),
            LusciiLayoutNode(
                id="n4", phase_id="p2", lane_id="l1", x=70, y=26,
                label="Oefening-log", type="task", timing_label="dagelijks",
            ),
            LusciiLayoutNode(
                id="n5", phase_id="p3", lane_id="l1", x=70, y=26,
                label="ODI herhaling", type="form", timing_label="W8",
            ),
            LusciiLayoutNode(
                id="n6", phase_id="p3", lane_id="l2", x=70, y=26,
                label="Pilot-evaluatie", type="milestone", timing_label="W8",
            ),
        ],
        edges=[
            LusciiLayoutEdge(id="e1", source="n1", target="n2"),
            LusciiLayoutEdge(id="e2", source="n1", target="n3"),
            LusciiLayoutEdge(id="e3", source="n2", target="n4"),
            LusciiLayoutEdge(id="e4", source="n2", target="n5"),
            LusciiLayoutEdge(id="e5", source="n5", target="n6"),
        ],
    ),
)


# ---------------------------------------------------------------------------
# Public registry — import this anywhere stub Luscii programs are needed.
# ---------------------------------------------------------------------------

LUSCII_STUB_PROGRAMS: tuple[LusciiProgramData, ...] = (
    _HARTFALEN,
    _COPD,
    _DIABETES,
    _RUGREVALIDATIE,
)

LUSCII_STUB_PROGRAMS_BY_ID: dict[str, LusciiProgramData] = {p.id: p for p in LUSCII_STUB_PROGRAMS}
