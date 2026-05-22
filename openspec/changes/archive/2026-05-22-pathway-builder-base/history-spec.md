# History Specification — Undo/Redo + Versions

Two distinct history layers for the pathway builder. Locked in this doc; updates to lifecycle / data model / topbar live in their respective spec files cross-referenced below.

**How to read this doc.**

- Two top sections (one per layer) + a shared interplay section + backend implications.
- Per-section template: *Purpose · Anatomy · Layout · Visual · Behavior · Data · States · Accessibility · Open*.
- Cross-refs: `builder-ui-spec.md` §1 (topbar undo/redo + Geschiedenis), §15 (drawer slot), §17 (save state), §25 (lifecycle); `design.md` D30–D31 + new D36–D40.
- Anything marked `TBD: Q{n}` is awaiting user decision; do not implement those bits until resolved.

---

## 0. The two layers, distinct

| Layer | Scope | Persistence | Trigger | Surface | Reset condition |
|---|---|---|---|---|---|
| **Undo/redo** | per-session local edits to the current version | in-memory only (dies on reload) | every mutating action | ⌘Z / ⌘⇧Z + topbar undo/redo icon buttons | on restore-from-history (Q4); on opening a different version |
| **Versions** | server-side snapshots of a pathway over time (immutable once published) | DB `pathway_version` table | promotion (publish) — flips current concept's row from `concept` → `published`. No mid-concept "checkpoint" action (D37). | `Geschiedenis` drawer (same slot as block-config drawer, mutex) | never (keep all forever) |

**Mental model (locked).** A `pathway` is a long-lived identity (name, owner, archived flag). A `pathway_version` is the editable thing. Versions form a strictly linear chain `v1 → v2 → v3 …` — no parallel branches (D38). Each version row begins life as `concept` (mutable, autosaved) and transitions exactly once to `published` (immutable). To change a published pathway, the user creates a new concept version derived from the latest published. Patient enrollments pin to a specific `pathway_version_id`: patients enrolled on v1 continue on v1 even after v2 is published; new enrollments default to the latest published. At any moment a pathway has at most one row with `status = concept`, enforced by a partial unique index `(pathway_id) WHERE status = 'concept'`.

---

## 1. Undo / Redo (in-session)

**Purpose.** Let the caregiver experiment freely on the current version without fear of losing intermediate states. Standard `⌘Z` / `⌘⇧Z` semantics, Google-Docs-style grouping.

**Anatomy.**
- Two topbar icon buttons (`undo` / `redo`, lucide icons) in the existing history-group cluster (`builder-ui-spec.md` §1 anatomy item 7).
- Hover tooltip on each button shows the localized "next undo target" / "next redo target" description (e.g. `Maak ongedaan: blok 'Intake' verplaatst`).
- Keyboard: `⌘Z` undo, `⌘⇧Z` redo (or `⌘Y` as redo alias on Windows).

**Layout.** As §1 of `builder-ui-spec.md`. No layout changes.

**Visual.** As §1 of `builder-ui-spec.md`. Buttons disabled (60% opacity) when corresponding stack is empty.

**Behavior — what's undoable.**

Every mutating action pushes one snapshot onto `history.past` BEFORE applying the mutation. Mutating actions:
- node add (from dock or drop)
- node move (drag end, not drag tick)
- node delete
- edge add (port→port connect)
- edge delete
- port-target change (reconnect)
- block config field commit (drawer)
- block name commit (inline edit)
- pathway title commit (topbar)
- lane add / lane rename / lane delete
- phase add / phase rename / phase delete / phase reorder
- block-group create / rename / reorder children
- block-group children add/remove

Non-undoable (out of scope): zoom, pan, selection, drawer open/close, autosave events.

**Behavior — Google-Docs-style grouping for field edits.**

Text input edits (block name, pathway title, drawer text/textarea fields) group into runs to keep undo coarse-grained:
- Continuous typing in the same field = one undo step.
- A new step commits when ANY of:
  - 1.5s pause without further input;
  - cursor leaves the field (blur);
  - selection / caret jump within the field;
  - direction change (typing → backspacing or vice versa) — a backspace run is grouped separately from a typing run.
- Non-text actions (add/move/delete/etc.) always push their own discrete step — no grouping.

**Behavior — Branching.**
- Any new action while `history.future` is non-empty clears `history.future` (standard).
- Cap: 50 entries each side; oldest dropped beyond cap.

**Behavior — Interaction with autosave (concept mode).**
- Autosave does NOT push or alter `history` (D31). Undo crosses autosave boundaries freely — undo can revert a change that has already been autosaved (and the resulting state will be autosaved in turn after the next debounce).

**Behavior — Interaction with versions.**
- Undo/redo stack lives entirely within the current version. Opening the Geschiedenis drawer does NOT reset history. Restoring from a historical version resets `history.past` and `history.future` to empty (per D, the post-restore state is a fresh baseline). See §3 for the exact restore flow.

**Data.**
- `history.past: PathwaySnapshot[]` (max 50).
- `history.future: PathwaySnapshot[]` (max 50).
- `PathwaySnapshot` is a deep clone of `BuilderState.pathway` (whatever the reducer's source of truth is). Reducers must not mutate snapshots.

**States.**
- `can-undo` = `past.length > 0`.
- `can-redo` = `future.length > 0`.

**Accessibility.**
- Buttons: `<button aria-label="Maak ongedaan {description}" aria-disabled="…">`. Description localized from the action type that produced the most recent snapshot.
- Live region announces "Ongedaan gemaakt" / "Opnieuw uitgevoerd" politely on activation.
- Respects `prefers-reduced-motion` — no transition animations on undo/redo (instant state swap).

**Open.**
- Whether to expose a click-and-hold dropdown on the undo button showing the last N entries (Figma-style). Parked.
- Whether `⌘Z` inside a focused text input should defer to the input's own undo (browser default for one step, then ours). Recommend: input owns undo while focused; ours kicks in once a non-text action commits.

---

## 2. Versions (server-side)

**Purpose.** Persistent, immutable history of a pathway. Every publish creates one. Restoring forks the chosen version into a new concept so the old version stays intact for any enrollment pinned to it.

**Anatomy (Geschiedenis drawer).**
- Header: drawer title `Geschiedenis` + close button.
- Filter row (parked for PoC — single sort default).
- Version list (reverse chronological):
  - Per item: `[kind-badge] [version-no] [label]` row 1; `[author-avatar] {author-name} · {timestamp}` row 2.
  - Kind badge: `Gepubliceerd` (success-tinted) / `Concept (huidig)` (warn-tinted — only on the in-flight concept row, if present) / `Hersteld van v.X` (info-tinted — published versions that were created via a restore flow).
- Selected-version detail panel (parked: PoC opens a separate read-only canvas view per §4).
- Per-row actions: `Bekijken` (always), `Herstellen` (always — but blocked with explanation if a concept already exists, per Q6), `Vergelijken` (parked post-PoC).

**Layout.**
- Drawer dimensions: identical to `builder-ui-spec.md` §15 (width 360px, slides in from right, glass-strong panel).
- Header: 14px 16px padding; close button top-right.
- List: `display: flex; flex-direction: column; gap: 4px;` body padding 12px.
- Item: `display: grid; grid-template-columns: auto 1fr auto; gap: 10px; padding: 10px 12px; border-radius: var(--r-sm);`.

**Visual.**
- Drawer chrome: reuse §15 glass-strong; no separate visual identity.
- Kind badge:
  - `Gepubliceerd`: bg `color-mix(in srgb, var(--success) 8%, var(--card))`, border `success 26%`, text `success`.
  - `Concept (huidig)`: bg `warn 8%`, border `warn 26%`, text `warn`. Always pinned to the top of the list when present.
  - `Hersteld van v.X`: bg `color-mix(in srgb, var(--info) 8%, var(--card))`, border `info 26%`, text `info`. Reuse existing info token; if absent, add `--info` per `builder-ui-spec.md` §22.
  - Dimensions: `inline-flex; height: 20px; padding: 0 8px; border-radius: 999px; font: 10.5px/1 weight 600 letter-spacing 0.04em uppercase`.
- Version number: 12.5px / weight 600 / `font-variant-numeric: tabular-nums` / foreground / `v.{n}` format.
- Label: 12px / weight 500 / foreground; auto-label fallback `Versie {n}` rendered in muted-foreground italic when no user label.
- Author avatar: 22px round, same hash-of-name gradient as builder presence stack.
- Author + timestamp: 11.5px / muted-foreground / `font-variant-numeric: tabular-nums`.
- Item hover: `background: rgba(11,26,23,0.04)`.
- Item selected (when previewing): border `1.5px solid var(--primary)`, background `color-mix(in srgb, primary 4%, transparent)`.

**Behavior.**

- **Opening the drawer.** Topbar `Geschiedenis` button toggles drawer. Mutex with block-config drawer (per Q6 in `builder-ui-spec.md` §15 — opening Geschiedenis closes block-config and vice versa). On open, list fetches via `useVersionList(pathwayId)`. Selected version: latest by default.
- **Viewing a version (`Bekijken`).** Navigates to `TBD: Q3 — historical view route`. Builder enters read-only mode: every interaction disabled, status pill replaced with a slim banner `Je bekijkt v.{n} (gepubliceerd {ts}). Niet bewerkbaar.` plus action button `Terug naar huidige versie`.
- **Restoring (`Herstellen`).**
  1. Pre-flight check (Q6 = a): if a `concept` version already exists for this pathway, the modal copy switches to `Er bestaat al een concept-versie (v.{n}). Wil je dat openen?` with buttons `Annuleren` (ghost) and `Open bestaande concept` (primary). Picking the primary navigates to bare `/pathways/{id}`; the restore request is NOT sent. If the user wants to restore the historical version on top of the existing concept, they must publish or discard the existing concept first. Server rejects the restore endpoint with 409 `concept_already_exists` as a backstop if the frontend skips this check.
  2. Confirmation modal: `Versie {n} herstellen?` body `Een nieuwe concept-versie wordt aangemaakt op basis van v.{n}. De huidige weergave verdwijnt niet — bestaande inschrijvingen blijven aan hun versie gekoppeld.` Buttons: `Annuleren` / `Herstellen`.
  3. On confirm: `POST /pathways/{id}/versions/{versionId}/restore` → server forks selected version's snapshot into a new concept version with `derived_from_version_id = {versionId}`, `kind = restore`, `label` auto = `Hersteld van v.{n}`.
  4. On success: in-memory undo stack flushed (`history.past = [], history.future = []`); cache updated to point at new concept; toast `pathway.history.restore.success`; drawer remains open with the new concept marked.
  5. On failure: toast `pathway.history.restore.error`; drawer stays open; no state change.
- **No explicit "save version" action exists** (D37). Concept is one continuous autosaved WIP — only promotion (publish) creates an immutable snapshot.
- **Publishing.** Per D30 + D31 + D42: clicking `Publiceren` (after autosave flush) opens the publish modal which now captures:
  - `label?` (optional, single-line text, max 120 chars) — placeholder `bijv. Post-MDR-update`. Empty = no label (falls back to `Versie {n}` rendering).
  - `note?` (optional, multi-line text, max 2000 chars) — placeholder `Wat is er veranderd t.o.v. de vorige versie?`. Surfaces in Geschiedenis drawer as expandable detail.
  - Acknowledgement checkbox `Ik bevestig dat deze versie klinisch is goedgekeurd en geschikt voor patiëntinschrijving` (required).
  - Confirm button is disabled until the checkbox is ticked; label and note remain optional.
  On confirm: server flips current concept to `published`, persists `label` + `note` + `published_at` + `published_by` on the same row, and surfaces success toast `Versie v.{n} gepubliceerd`. The body of the post-success toast mentions `Bekijk de Geschiedenis voor alle versies`. Concept rows and restored/forked rows keep their auto-labels (`Werkversie`, `Nieuw concept op v.{n}`, `Hersteld van v.{n}`) — labels there are NOT user-editable in PoC.

**Data.**

- `useVersionList(pathwayId)` → `GET /pathways/{id}/versions` → `PathwayVersionSummary[]`.
- `PathwayVersionSummary { id, version_no, kind: 'initial'|'fork-from-publish'|'restore-from-version', status: 'concept'|'published'|'archived', label?, note?, created_at, created_by: { id, name, avatar_url? }, published_at?, published_by?: { id, name }, derived_from_version_id? }`. `kind` describes how this version row came into existence; `status` describes where it is now in its lifecycle.
- `useVersion(pathwayId, versionId)` → `GET /pathways/{id}/versions/{versionId}` → full snapshot.
- `useRestoreVersion()` mutation → `POST /pathways/{id}/versions/{versionId}/restore` → returns new concept version summary; `queryClient.invalidateQueries(versionKeys.list(pathwayId))` + `setQueryData(pathwayKeys.detail(pathwayId), {...})` to swap the active concept.

**States.**

- Drawer states: `closed` / `loading-list` / `ready` / `empty` (no published versions yet — pathway has only its initial concept row) / `error`.
- Per-item states: `default` / `hover` / `selected` / `restoring` (spinner replaces actions cluster).

**Accessibility.**
- Drawer: `<aside role="complementary" aria-label="Geschiedenis">` with focus trap while open.
- List items: `<button>` semantics with `aria-current="true"` on the currently active version.
- Restore confirmation: `<Dialog role="alertdialog">` (consequential action).
- Read-only banner uses `role="status"`.

**Open.**
- Lineage tree visualization in drawer (parked — list is enough for PoC).
- Filter / search across versions (parked).
- Side-by-side compare (parked post-PoC per C = a).
- ~~TBD: Q5 — does label apply to all snapshots or only publishes?~~ → **resolved (a)** — labels are captured at publish time only (see §2 behavior `Publishing` + D42).

---

## 3. Interplay between layers

Locked rules so the two layers never contradict each other.

- **Undo doesn't reach across versions.** Opening another version (view or restore) discards `history`. The new baseline is whatever version is now open. Reasoning: undoing into a state that was never editable is confusing.
- **Restore is non-destructive (B = b).** It never overwrites; it forks. The pre-restore version stays in `pathway_version` untouched.
- **Publish flushes autosave first** (D31). Publishing also flushes `history.future` (the publish becomes the new "you've committed to this" point) but keeps `history.past` (Q4 / I = a — locked: undo across publish allowed). Effect: after a publish, the user can still undo back into the now-published state; further undos travel back through the concept-before-publish edits. Those undos do NOT change the published version's snapshot — they mutate the new concept that the fork-on-edit will be based on. See §4.
- **Editing a published version is impossible.** Triggering any mutating action while viewing a published version pops a modal `Maak een nieuwe versie om wijzigingen te maken?` with `Annuleren` / `Maak nieuwe versie` actions. The latter calls `POST /pathways/{id}/versions/fork-from/{versionId}` (or restore — same backend path, different intent label) → creates new concept derived from published → routes to new concept's editable URL.
- **Undo of a `publish` event itself is NOT possible** (publishing creates a permanent server record). The undo stack tracks edits within a version, not lifecycle transitions. Pressing `⌘Z` immediately after a successful publish undoes the edit BEFORE the publish, not the publish itself. The published version stays in history.
- **Concurrent edits.** Out of scope for PoC. If two caregivers open the same concept, last-write-wins via autosave + manual save. Presence stack (parked) will surface co-editors later; conflict resolution UI parked.

---

## 4. Fork-on-edit (the published → concept transition)

**Purpose.** Implements I — published versions are immutable; editing forks a new concept.

**Trigger.** User is viewing a `published` version (because no concept exists for this pathway, or they explicitly opened a published version) and attempts any mutating action.

**Flow.**
1. Mutation handler intercepts. Builder enters a transient "intent" state — no actual mutation applied yet.
2. Modal `Nieuwe versie nodig`:
   - Body: `Deze versie is gepubliceerd en kan niet worden bewerkt. Wil je een nieuwe concept-versie aanmaken op basis van v.{n}?`
   - Footer: `Annuleren` (ghost) / `Maak nieuwe versie` (primary).
3. On confirm:
   - `POST /pathways/{id}/versions/fork-from/{versionId}` → server creates new concept version with snapshot = old version's snapshot, `derived_from_version_id = {versionId}`, `kind = fork-from-publish`, `label` auto = `Nieuw concept op v.{n}`.
   - Cache pre-seeded with new concept (no flash).
   - Route navigates to the editable URL for the new concept.
   - Builder applies the originally-intercepted mutation as the first edit in the new concept (so the click that triggered the fork "just works" after the modal).
4. On cancel: intercept dropped; no mutation applied; user stays in read-only view.

**Data.** `useForkVersion()` mutation.

**Behavior — race with existing concept (Q2 = single).**
- If a concept already exists, the modal copy changes to `Er bestaat al een concept-versie. Wil je dat openen?` with `Annuleren` / `Open bestaande concept` (navigates to the existing concept).
- The "fork from this exact published version" intent is then refused — user must publish or discard the existing concept first.

**Accessibility.** Confirmation: `<Dialog role="alertdialog">`. The intercepted mutation must not announce twice — debounce the intercept until the modal resolves.

---

## 5. Routes (history-related)

**Resolved Q3 = (iii) — hybrid.** Two URL shapes; the loader decides which version is in scope.

| Route | Resolves to | Editability |
|---|---|---|
| `/pathways/$pathwayId` | latest concept if one exists for this pathway, else latest published | concept = fully editable (autosaved); published-fallback = read-only with "Maak nieuwe versie" CTA |
| `/pathways/$pathwayId/v/$versionId` | the specified historical version (any status) | always read-only |

**Loader contract.**
- `/pathways/$pathwayId`: `GET /pathways/{id}` returns `{ pathway, version }` where `version` is the resolved version (latest concept OR latest published). Response includes `version.status` so the shell can decide read-only chrome.
- `/pathways/$pathwayId/v/$versionId`: `GET /pathways/{id}/versions/{versionId}` returns the same shape pinned to a specific version. 404 if `versionId` does not belong to `pathwayId`.

**Read-only chrome activation rule.** Shell enters read-only when EITHER:
- the URL contains `/v/$versionId` (always read-only), OR
- the resolved version's `status !== 'concept'` (published fallback because no concept exists).

The two cases differ only in CTA — see §5b for the banner copy + actions.

**Fork-on-edit URL transitions** (see §4).
- When `POST /pathways/{id}/versions/fork-from/{versionId}` succeeds, the router navigates to the bare `/pathways/{id}` (which now resolves to the freshly-created concept).
- Restore (`POST .../restore`) likewise navigates to bare `/pathways/{id}`.
- No URL ever points at `/pathways/{id}/v/{conceptVersionId}` for the active concept — the bare URL is the canonical concept location. This keeps shareable links stable: a concept's URL never reveals its version_id.

**Resolved Q4 = (i).** Overview row click on a published-only pathway navigates to bare `/pathways/{id}`. Per the hybrid route rule (D36) the loader resolves to the latest `published` version and the shell enters read-only chrome with the published-fallback banner variant (CTA `Maak nieuwe versie`). No modal, no auto-opened drawer. Row click means "open the thing"; if the user wants to edit they pick up the fork affordance from the banner one click later.

---

## 5a. Topbar version-switch chip

**Purpose.** Tiny, always-visible dropdown that shows the active version and lets the caregiver hop to any other version in two clicks. Sits inside the topbar action cluster (immediately left of `Opslaan`) — not a floating control. Replaces the standalone `Geschiedenis` ghost button in the topbar; the full drawer is reachable from this menu's footer link.

**Anatomy.**
- Trigger: `<button>` with three inline children — colored status dot · version number (`v.5`) · chevron-down icon. Height 24px. Border 1px hairline, transparent background, 7px radius. No label like "Versie" — the dot+number is enough context inside the topbar's identity-rich strip.
- Menu (popover, anchored bottom-right of trigger): 240px min-width, glass-strong surface, 10px radius, 12px-28px shadow.
- Menu body: two grouped sections — `Werkversie` (the single concept row if present) and `Gepubliceerd` (latest published + any historical versions, reverse-chrono). Each section labeled by a 10px uppercase muted eyebrow.
- Per-item row: colored status dot · `v.{n}` (700 weight, tabular-nums, min 28px col) · state word (`concept` / `gepubliceerd` / `historisch` — muted) · trailing checkmark icon (visible only when item = current).
- Menu footer: ghost button `Alle versies in geschiedenis` with clock-icon → opens full Geschiedenis drawer (§2). This is the only way into the drawer for now; the old standalone topbar button is removed.

**Layout.** Trigger flows inline in the topbar action group between the `Geschiedenis`-replaced slot and `Opslaan`. Menu anchored `top: 30px; right: 0;` relative to trigger; popover z-index 40 (above topbar, below modal).

**Visual.**
- Status dot colors map to `version.status`: `concept` → warn (`#d97706`), `published` (latest) → success (`#16a34a`), historical (any non-latest published) → info (`#3a7d8d`).
- Active item in menu: foreground tinted `#08453c` + bold + visible check; hover row: `rgba(11,26,23,0.05)` bg.
- Group eyebrow: 10px / 700 / 0.08em letter-spacing / muted-foreground.
- Trigger color does not change with state — the dot carries the state signal; the number stays neutral foreground. This keeps the topbar visually calm.

**Behavior.**
- Click trigger → toggles menu open; `aria-expanded` flips.
- Click outside menu → closes.
- Pick item → applies the corresponding navigation:
  - Werkversie item (concept) → navigate to bare `/pathways/{id}`.
  - Gepubliceerd item (latest published) → navigate to bare `/pathways/{id}` (which falls back to latest published when no concept exists) OR to `/pathways/{id}/v/{versionId}` when a concept also exists (since bare would resolve to concept). Rule: if the target version is the one the bare URL would currently resolve to, use bare; otherwise use `/v/{versionId}`.
  - Historical item → navigate to `/pathways/{id}/v/{versionId}`.
- Picking the already-active item → close menu, no navigation.
- Trigger stays interactive while shell is read-only (the user needs an escape route). It is NOT dimmed by the `is-readonly` chrome rule.
- Footer link → opens Geschiedenis drawer (§2), closes the popover.

**Data.**
- Trigger reads the resolved version from the shell's loader.
- Menu reads the same `useVersionList(pathwayId)` as the Geschiedenis drawer — cached together.
- Menu fetch is deferred until first open (popover-on-demand), then cached for the session.

**States.**
- Trigger: `default` / `hover` / `open`.
- Menu: `loading-list` (skeleton rows) / `ready` / `error` (single error row + retry). When `error`, footer link still works.

**Accessibility.**
- Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-label="Wissel versie, huidig v.{n} {status}"`.
- Menu: `role="menu"` with `role="menuitem"` rows; current row has `aria-current="true"`.
- Keyboard: `↑ ↓` cycle items; `Enter` activates; `Esc` closes; `Tab` from trigger → first item.
- Color-coded dots are decorative — every row already labels the state in text.

**Open.**
- Whether to show only the 3–5 most recent published versions in this menu and require the drawer for full history. Recommend yes if the list grows beyond ~7. Parked for PoC (Rugrevalidatie has 1–2 versions).

---

## 5b. Read-only banner overlay

**Purpose.** When the shell is read-only (per §5 activation rule), a thin tinted strip directly below the topbar tells the user WHY they can't edit and offers the right escape action. The strip stretches across the canvas frame width; the canvas itself does not move (the banner lives in the same vertical slot the subbar would otherwise own — banner stacks on top of subbar).

**Anatomy.**
- Container: 36px height, full-width strip, glass-tinted background, 1px bottom hairline.
- Left: 14px info-circle icon.
- Center: prose body — `Je bekijkt v.{n} · gepubliceerd op {date}. Dit is een historische versie.` (historical) OR `Deze versie is gepubliceerd en wordt gebruikt door lopende zorgpaden. Maak een nieuwe versie om wijzigingen te doen.` (published-fallback).
- Right: secondary `Terug naar huidige` (ghost, only when historical AND a current resolution exists) + primary CTA. CTA label depends on case:
  - Historical → `Herstel als nieuw concept`.
  - Published-fallback (no concept exists) → `Maak nieuwe versie`.

**Layout.** Sits between the topbar `<header>` and the phase subbar (the subbar still renders so the user can navigate the canvas read-only). Body is `flex: 1; align-items: center`. Buttons are 24px tall, 6px radius, primary CTA uses the gradient-active treatment.

**Visual.**
- Historical variant: bg gradient `color-mix(in srgb, info 10%, white) → info 4%`, bottom-border `info 22%`, text `#2c6473`.
- Published-fallback variant: bg gradient `color-mix(in srgb, success 8%, white) → success 3%`, bottom-border `success 22%`, text `#166534`.
- Variant choice is driven by `version.status` of the resolved version — NOT by the URL shape. (The crumb-version marker color and ver-switch dot follow the same rule.)

**Behavior.**
- Banner appears only when shell is read-only.
- "Terug naar huidige" → navigate to bare `/pathways/{id}`.
- "Herstel als nieuw concept" → fires the restore flow (§2 behavior `Herstellen`). Confirmation modal still required.
- "Maak nieuwe versie" → fires fork-on-edit (§4) without an intercepted mutation: the modal asks confirmation, then forks and routes to the new concept's bare URL.
- The blocked-mutation modal from §4 still fires if the user tries to interact with a block on a read-only canvas. The banner CTA is the proactive path; the modal is the reactive path.

**Data.** None of its own — derives entirely from the resolved version.

**States.**
- `hidden` (concept editable) / `visible-historical` / `visible-published-fallback`.

**Accessibility.**
- `role="status"` so screen readers announce mode change on navigation.
- CTA: full `<button>` with descriptive label, not just icon.
- Reduced motion: no slide-in animation, instant show.

**Open.**
- Whether the banner should also surface for `concept` versions in a special "co-editor is active" presence case. Parked with concurrent editing (§3).

---

## 5c. Crumb version marker

**Purpose.** Tiny inline marker in the topbar crumbs row that always shows `v.{n} {state}` next to the pathway name. Calm, always-on, no chip — just a colored dot + tinted text. Pairs with the ver-switch chip (5a) which is the interactive control; this is the passive identity stamp.

**Anatomy.**
- `<span>` placed inside the existing crumbs `<div>`, after the breadcrumb leaf (`Rugrevalidatie`).
- Three inline children: 6px colored dot · `v.{n}` (weight 600, tabular-nums) · state word (lowercase, opacity 0.75).

**Layout.** Margin-left 6px from the breadcrumb leaf; inherits crumbs row font-size (~11.5px). No background, no border, no padding.

**Visual.** Foreground color is the variant color (concept warn, published success, historical info). Dot uses `currentColor`, state word inherits at reduced opacity.

**Behavior.** Display-only — not interactive. Hover does nothing; the ver-switch chip is the interactive surface.

**Data.** Reads `version.version_no` + `version.status` from shell loader.

**States.** `concept` / `published` / `historical` — color-only differences.

**Accessibility.** Wrapped in a `<span>` (not a button); the version+state are also exposed via the ver-switch trigger's `aria-label`, so this is decorative-redundant for screen readers. Hide from AT with `aria-hidden="true"` to avoid duplicate announcements.

---

## 5d. URL bar truth (prototype demonstration only)

The prototype's faux browser chrome shows that the URL flips from bare `/pathways/{id}` to `/pathways/{id}/v/{versionId}` when switching to a historical version. This visualizes the loader contract in §5 — it is NOT a UI component in the shipped app (the real browser owns the URL). Captured here only so the design intent reads clearly when the prototype is replayed.

---

## 6. Backend implications

These are derived from this spec; not yet expressed as a backend spec file (this change focuses on UI). When the backend spec is written, mirror what's locked here.

**New table — `pathway_version`** (per-pathway-version):
- `id` — PK from `Entity`.
- `pathway_id` — FK to `pathway`, ON DELETE CASCADE.
- `version_no` — int, monotonically increasing per pathway, server-assigned.
- `status` — enum `concept` | `published` | `archived`. At most one `concept` per pathway (Q2 = single, default).
- `kind` — enum `initial` | `fork-from-publish` | `restore-from-version`. Describes how this row came into existence. No `checkpoint` kind (D37).
- `derived_from_version_id` — nullable FK to `pathway_version`, ON DELETE SET NULL.
- `snapshot` — relational FK tree (NOT jsonb): the version's pathway definition stored in `pathway_phase`, `pathway_lane`, `pathway_block`, `pathway_edge`, `pathway_block_branch`, `pathway_time_marker` — all of which gain a `pathway_version_id` FK in addition to (or replacing) their current `pathway_id` FK.
- `label` — nullable string (max 120 chars).
- `note` — nullable text.
- `published_at` — nullable timestamp (set when status flips to published).
- `published_by` — nullable FK to `user`.
- `created_at` / `created_by` / `updated_at` / `updated_by` from base `Entity`.
- UNIQUE `(pathway_id, version_no)`.
- UNIQUE filtered: at most one `(pathway_id) WHERE status = 'concept'` (enforced by partial unique index — if Q2 = single).

**Migration consequence.** Existing per-pathway tables (`pathway_phase`, `pathway_lane`, `pathway_block`, etc.) move their `pathway_id` FK to `pathway_version_id`. The conceptual `pathway` row keeps only: `id`, `tenant_id`, `name`, `clinical_goal`, `patient_goal`, `owner_id`, `archived_at`, plus base `Entity` fields. No structural content lives on `pathway` directly anymore — everything structural is per-version.

**Pathway-level rollups are derived, not stored (Q8 = a → c on scale trigger; D45).** The overview list needs `latest_published_version_id`, `latest_published_at`, `has_concept`, `block_count`, `last_edited_at` per pathway. PoC computes these on read via LATERAL joins on `pathway_version` and an aggregate on `pathway_block` — no denormalized columns on `pathway`. Required indexes to keep the derived query fast at scale:
- `pathway_version (pathway_id, status, published_at DESC)` — drives "latest published per pathway" LATERAL.
- `pathway_version (pathway_id) WHERE status = 'concept'` — same partial unique index from D38 doubles as the `has_concept` lookup.
- `pathway_block (pathway_version_id)` — drives the `block_count` aggregate.
- `pathway (tenant_id, deleted_at, updated_at DESC)` — overview list filter + ordering.

**Migration to hybrid if scale bites.** If a single tenant's overview crosses a measurable latency budget (~200ms p95), promote `latest_published_version_id` + `has_concept` to columns on `pathway` written transactionally by publish/restore/fork/discard. Keep `block_count` + `last_edited_at` derived to keep the autosave hot path off the parent row (autosave must not write `pathway`). Migration: ADD COLUMN, backfill UPDATE, update the 3 lifecycle writers — purely additive, no removed fields, no API-shape change (the orchestrator still reads the same fields off the overview response).

**Endpoints (sketch — not final):**
- `GET /pathways/{id}/versions` — list summaries reverse-chrono.
- `GET /pathways/{id}/versions/{versionId}` — full snapshot.
- `POST /pathways/{id}/versions/{versionId}/restore` — fork into new concept; returns new version.
- `POST /pathways/{id}/versions/fork-from/{versionId}` — alias of restore with `kind = fork-from-publish` (or unify; pick one path).
- `POST /pathways/{id}/publish` — flips current concept → published; creates the version row's `published_at` + `published_by`. Already in D30 sketch; same endpoint.
- (No checkpoint endpoint — D37.)
- `GET /pathways/{id}` — must specify which version is returned: latest concept if exists, else latest published. Frontend can append `?version_id=…` to force a specific version (for historical view).
- `PUT /pathways/{id}` and autosave: server resolves to the current concept version, OR 409 if no concept exists (forces the frontend to fork first via the fork-on-edit flow §4).

**Validation.**
- Reject mutations on a published version with 409 and a machine-readable error code (`pathway_version_immutable`) so the frontend can trigger the fork-on-edit modal.
- Reject restore if a concept already exists (Q6 = require-no-concept) with 409 + error code `concept_already_exists`.

---

## 7. Tokens reference

New tokens this surface requires:

- `--info` (if not already present in tokens.css) — neutral teal-blue for "informational" badges and the `Hersteld van v.X` kind badge. Suggested: `#3a7d8d` ink, soft variant 8%.
- All other styling reuses existing tokens.

---

## 8. Out of scope (explicit non-requirements)

- Side-by-side version compare (C = a, not c — PoC ships read-only view only).
- Tree-style lineage visualization in the Geschiedenis drawer.
- Multiple parallel concept branches (TBD: Q2 default = single).
- Permission gating on restore / view (J = no permission system yet).
- Cap or compression on version retention (H = keep all forever).
- Real-time presence on the drawer ("Levi is bekijkt v.7").
- Diff export / PDF.
- Bulk restore.

---

## 9. Open questions (the ones I'm asking you about next)

Tracked here so future readers know which TBDs in the doc map to which questions:

- ~~**Q1** — Explicit `Bewaar versie` action within concept yes/no?~~ → **resolved (a)** — no checkpoint action; concept is one continuous WIP, only promotion (publish) snapshots. See D37.
- ~~**Q2** — One concept per pathway max, or multiple parallel drafts?~~ → **resolved (i)** — at most one concept per pathway, linear chain enforced by partial unique index. See D38.
- ~~**Q3** — Route resolution for `/pathways/$pathwayId`?~~ → **resolved (iii)** — hybrid: bare URL resolves to current (concept-if-exists else latest published, read-only fallback); `/v/$versionId` opens specific historical version. See §5 + D36.
- ~~**Q4** — Overview-row click behavior for published-only pathway?~~ → **resolved (i)** — row click navigates to bare `/pathways/{id}`; loader falls back to latest published; published-fallback banner offers `Maak nieuwe versie`. No modal, no auto-drawer. Consistent with D36.
- ~~**Q5** — Version label scope: publishes only, or all snapshots?~~ → **resolved (a)** — labels captured at publish time only via the publish modal (optional `label` + optional `note` + required clinical-approval checkbox); concept/restore/fork rows keep auto-labels. See §2 behavior `Publishing` + D42.
- ~~**Q6** — Restore preconditions when a concept already exists: block, auto-discard, or open existing?~~ → **resolved (a)** — block. Modal switches copy + offers "Open bestaande concept" escape; server enforces with 409 `concept_already_exists`. See §2 behavior `Herstellen` + D43.
- ~~**Q7** — Track `derived_from_version_id` lineage?~~ → **resolved (a)** — yes, always. Stored on `pathway_version` as nullable FK; populated on `restore-from-version` and `fork-from-publish` rows; drives auto-labels `Hersteld van v.{n}` and `Nieuw concept op v.{n}`. See §6 + D44.
- ~~**Q8** — Pathway-level status fields: derived (`has_concept`, `latest_published_id`) or stored?~~ → **resolved (a → c on scale trigger)** — pure-derived for PoC; if a single tenant ever exceeds ~200 pathways with measurable overview latency, migrate to hybrid (`latest_published_version_id` + `has_concept` denormalized on `pathway`; `block_count` + `last_edited_at` stay derived to keep the autosave hot path off the parent row). Migration is purely additive (add columns + backfill). See §6 + D45.
