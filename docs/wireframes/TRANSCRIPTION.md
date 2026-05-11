# Pathway Builder · Design Transcription

Log van vindingen, beslissingen en iteraties tijdens design exploration voor ZAS orchestrator MVP — Pathway Builder UI.

## Context

- **Klant**: ZAS ziekenhuis (Antwerpen, fusie ZNA+GZA). Belgische telegeneeskunde tender.
- **Probleem**: orchestrator layer tussen gebruiker, ZAS systems, HiX EPD, Luscii.
- **Concept**: Pathway Builder (designer) + Pathway Orchestrator (runtime per patiënt).
  - Builder = ontwerper bouwt herbruikbaar zorgpad.
  - Orchestrator = voert pathway uit voor specifieke patiënt, event-sourced state.
- **Scope MVP**: 5 zorgpaden — rugrevalidatie, blaaskanker, oncologie dagbehandeling, pneumologie, holter cardio.

## Naam

- Code: `Care Pathway` (HL7 standard term)
- UI Nederlands: `Zorgpad`

## Architectuur sketch

- Pathway Blueprint (versioned) — definition
- Pathway Instance — runtime per patiënt
- Event Bus — state changes
- Integration Adapters — HiX (Zorgplatform/FHIR), Luscii (programs API), email, push

Step types: `luscii.program`, `hix.task`, `hix.appointment`, `email.send`, `manual.gate`, `decision`, `timer`, `parallel.split`, `loopback`.

Tradeoff: Camunda/Zeebe (snelle MVP) vs custom state machine (lichter als step-catalog klein blijft). Geen beslissing genomen.

## UI Iteraties — Builder

### v0 — eerste poging
Initiële wireframe (`builder.html` v0):
- 4 swimlanes (Patiënt / Zorgverlener / Systeem / Extern)
- Linker palette
- Rechter props panel
- Validator footer
- SVG curved connectors

Feedback: te druk, te veel visuele ruis.

### v1 — sleek pass
- Inter font
- Monochrome palette (`--ink: #0a0a0a`)
- Soft shadows
- Validator footer weg
- Dot-based lane labels (gekleurde dot per actor)
- Refined typography

### v2 — tree exploration (verwijderd)
**Vraag**: BPMN swimlanes vs tree-style?

Eerste poging: vertical indented tree (list met inspring per child) — niet wat user bedoelde.
Tweede poging: classic CSS family-tree (top-down, parent splits naar children side-by-side, horizontale connector lines).

**Conclusie**: tree-aanpak afgewezen. BPMN swimlanes blijft.

Tradeoffs vastgelegd:
- Tree wint bij lineaire flows, makkelijk lezen, subtree copy-paste.
- BPMN wint bij parallelle takken + multi-actor handoffs (lijkt op klinische werkelijkheid).
- Bij MVP: meeste paden hebben paar beslissingen, parallel = wel cruciaal → BPMN.

### v1 — cleanup pass
- Canvas herstructureerd: aparte `lane-rail` (labels) + `lane-field` (single coord space)
- Vroeger probleem: grid-based lanes met 116px label-offset misaligned met SVG-coords. Opgelost door 1 coordinate space.
- Lanes 4 → 3 (Patiënt / Zorgverlener / Extern). System wordt chip op timer-node, geen aparte lane.
- 1 decision i.p.v. 2 — clutter weg.
- Diamond shape 64 → 80px, parallel split eigen `.node.parallel` (was hacky inline).
- JA/NEE labels groen/rood gekleurd op connectors.

### v1 — palette weg, floating dock
- Linker palette aside verwijderd.
- Floating dock middle-bottom: icon-only tiles, separators per categorie (Triggers · Luscii · HiX · Logica · Notif · End).
- Search-tile links met `/` keyboard hint, `+` more-tile rechts.
- `canvas-scroll` wrapper toegevoegd zodat dock niet meescroll bij horizontale pan.
- Tooltip op hover toont volledige blok-naam.

### v1 — props weg, dialog
- Rechter `aside.props` verwijderd. Main grid wordt 1fr (volle canvas).
- Native `<dialog>` modaal: click op blok = `showModal()`.
- Dialog content: icon-badge + naam + tabs (Algemeen/Data/SLA/Audit) + velden + footer (Verwijderen/Annuleren/Opslaan).
- Backdrop met blur, soft shadow, 480px breed, z-index 10000.

### v1 — lijnen orthogonaal
- Bezier curves → Manhattan routing (H + V segments).
- `stroke-linejoin: round` → hoeken net iets gerond, niet hard scherp.
- JA/NEE labels herpositioneerd boven bend punten.
- NEE bypass loopt nu netjes onder Order door, rechtsom omhoog naar End.

## 3D Mentaal Model

Tijdens v1 emerged een mentaal model: pathway = **3 dimensies**.

1. **Actor** (wie) — Patiënt / Zorgverlener / Extern (zichtbaar als lanes).
2. **Tijd** (wanneer) — dag −3, dag −1, dag 0 etc. Nu impliciet via timer-nodes + meta text. Mogelijk explicieter te maken.
3. **Fase** (waar in flow) — Pre-screening / Klinisch besluit / Follow-up. Nu impliciet via spatial ordering. Mogelijk als banner-groepering.

Plus: **loopback action** — als stap mislukt (bv. fout bloedmonster), terug naar eerdere stap voor retry. Niet alleen lineair forward, maar feedback-loops mogelijk.

## v1.1 — geïmplementeerd

- [x] Fase-banner top in canvas (3 gekleurde bands)
- [x] Loopback arrow (amber, dashed, eigen marker)
- [x] Loopback / retry tile in dock
- [x] Tijd-hint in canvas-bar
- [x] Vertical dotted guides voor tijd-markers (dag 0, +1, +4)

### v1.1 — Algemeen zorgpad uit `BIJLAGE - Proces Zorgtraject telegeneeskunde algemeen.pdf`

Mapping BPMN-PDF → builder canvas:

- 3 swimlanes: Patiënt / Zorgverlener / **ZAS EPD** (3e lane hernoemd van "Extern")
- Fasen (banners):
  - **Initiatie** (amber): opstart + gegevens-controle in ZV-lane.
  - **Patiënt onboarding** (blauw): informeren → IC → vragenlijsten.
  - **Klinische review** (groen): goedkeuren zorgpad + data wegschrijven.
- Nodes (13):
  - ZV: Start → Opstarten zorgpad (HiX) → Controleren persoonsgegevens (manueel) → ⟂ Gegevens OK? → Goedkeuren zorgpad (gate) → End OK.
  - Patiënt: Informeren patiënt (push) → Opvragen IC (Luscii) → ⟂ IC gegeven? → Invullen vragenlijsten (Luscii). NEE-IC eindigt in stop-end (rood).
  - ZAS EPD: Aanpassen gegevens in EPD (HiX) — target van NEE-loopback. Wegschrijven data in EPD (HiX) — sink voor vragenlijst-output via dashed data-flow.
- Loopback: Aanpassen gegevens → terug naar Controleren persoonsgegevens (amber dashed met `↻ refresh` label).
- Stop-end: Diamond IC NEE → rood eindpunt (zorgpad stopgezet bij geweigerd IC).
- Tijd-markers: dag 0 (start), +1 (patiënt onboarding), +4 (klinische review).

Niet gemodelleerd in v1.1 (PDF heeft het wel):
- "Tweede weigering" pad (eerste weigering → contacteren patiënt → tweede weigering → stopgezet) → samengevat in single stop-end.
- Aparte "Doorsturen data naar EPD" stap → samengevoegd met "Wegschrijven data".
- Subprocessen "Adviseren zorgpad" en "Uitvoeren of aanvragen zorgpadtaken" (PDF pagina 3-5) → blijven uit v1.1 om canvas leesbaar te houden.

## Open vragen

- Camunda/Zeebe vs custom orchestrator?
- Wie heeft eigenaarschap blueprint-versies? Klinische review-workflow.
- FHIR profielen — welke BE-profielen leveren we (PROM, CarePlan, Task)?
- Hoe omgaan met patient-initiated events (bv. patiënt belt af) tov. scheduled pathway?

## Bestanden

- `builder.html` — current stable, v1 met dock + dialog + orthogonal lines
- `builder-v1.1.html` — work in progress, 3D model + loopback
