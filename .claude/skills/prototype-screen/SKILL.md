---
name: prototype-screen
description: Use when the user wants to prototype a UI screen for the active OpenSpec change before writing any React/backend code. Triggers on phrasings like "let's prototype X", "mock up the X screen", "html prototype of …", "make a v1 of …". Produces versioned, self-contained HTML files under `openspec/changes/<change>/prototypes/<name>/vN.html` that mirror the orchestrator's Tailwind v4 + ZAS-teal design tokens. Each iteration creates a new `vN.html` — never edit prior versions.
metadata:
  author: zas-wrapper
  version: "1.1"
---

# prototype-screen

HTML prototyping skill for OpenSpec changes. Prototypes live next to `proposal.md` / `design.md` and get archived/deleted with the change. Same visual language as the orchestrator (Tailwind v4 + ZAS-teal tokens + Geist), zero build step — just open in a browser.

## When to invoke

Trigger on:
- "prototype the X screen"
- "mock up the X view"
- "html prototype of …"
- "let's sketch the …"
- "make a v1 of the …"
- "version 2 of the prototype …"
- Any UI exploration where the user explicitly wants to *see* something before backend wiring.

**Do not trigger for:**
- Real route work in `apps/orchestrator/src/routes/` (use `design-list-overview` or normal flow).
- Pure design-token tweaks (edit `tokens.css` directly).
- `.pen` file work (use pencil MCP).

## Folder convention

```
openspec/changes/<change-name>/
  proposal.md
  design.md
  prototypes/
    <prototype-name>/        # kebab-case, e.g. luscii-program-block
      v1.html
      v2.html
      v3.html
      ...
```

**Versioning rule:** every iteration creates the next `vN.html`. **Never overwrite** a prior version — earlier versions are the breadcrumb trail of the design conversation. Diff-friendly progression.

## Process

### Step 1 — Locate the active OpenSpec change

Look for the change in (in this order):
1. The current worktree's branch name (e.g. `feat/nested-paths-luscii-blocks` → check `openspec/changes/external-block-integrations` and `openspec/changes/nested-pathway-blocks`).
2. `git status` / recently touched files under `openspec/changes/`.
3. If ambiguous, **ask the user** which change the prototype belongs to.

Never invent a change folder. If none exists for the user's request, halt and suggest running `/opsx:propose` first.

### Step 2 — Intake (one tight question, batch if natural)

Ask:
1. **Prototype name** (kebab, e.g. `home-screen`, `luscii-program-inspector`).
2. **What does the screen show?** One paragraph. Mention any specific data, states, or interactions the user wants visible.
3. **Existing prototype to iterate, or new?** If the folder already exists, default to bumping to the next `vN.html` and ask what changes vs the previous version.

If the user has already given enough detail (e.g. earlier in the conversation), skip the questions and confirm: *"Creating `prototypes/<name>/v1.html` showing X, Y, Z — correct?"*

### Step 3 — Determine the next version number

```bash
ls openspec/changes/<change>/prototypes/<name>/ 2>/dev/null
```

- Folder missing → `v1.html`.
- Folder exists → find highest `vN.html`, write `v(N+1).html`.
- Never overwrite. Never delete prior versions without explicit user request.

### Step 4 — Read current design tokens (no static snapshot)

Read `apps/orchestrator/src/styles/tokens.css` **fresh every scaffold**. Inline the entire file's content into the prototype's `<style type="text/tailwindcss">` block.

This avoids the snapshot-drift problem — every new prototype gets whatever is current in the orchestrator. No template to keep in sync.

If the user is iterating on an existing prototype (`vN` → `v(N+1)`):
- Copy the latest `vN.html` as the starting point.
- Re-read `tokens.css` and replace the token block if it has changed. Skip the rewrite if unchanged.

### Step 5 — Assemble the HTML inline

Compose the prototype's HTML as one self-contained file, in this order:

1. `<!DOCTYPE html>` + `<head>` with:
   - Title: `PROTOTYPE — <name> vN`
   - Fontsource Geist + Geist Mono via CDN: `https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@5/index.css` and `…/geist-mono@5/index.css`
   - Tailwind v4 browser build: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`
   - Lucide icons: `https://unpkg.com/lucide@latest/dist/umd/lucide.js`
   - `<style type="text/tailwindcss">` containing the **freshly-read** contents of `apps/orchestrator/src/styles/tokens.css`, then a small utilities block for `body` (font + aurora background) and `.glass` / `.glass-strong`.
2. `<body>`:
   - Top comment block describing the inline mock data.
   - App-shell scaffold (sidebar + topbar + content) when the screen sits inside the main app; OR a single centered card if the screen is standalone (e.g. a modal / inspector preview).
   - Screen-specific content.
3. Tail `<script>` calling `window.lucide.createIcons()`.

**Constraints (do not violate):**
- Zero fetches. No `/api/...`. All data inline as JS consts in a `<script>` block or hard-coded in markup.
- No npm imports, no React, no orchestrator components. Re-implement the visual with plain `<div>` + Tailwind utilities + ZAS tokens.
- Only the CDNs listed above. No random font/icon services.
- Reference tokens via Tailwind arbitrary values: `bg-[--color-primary-soft]`, `text-[--color-foreground-muted]`, `rounded-[--radius-md]`, etc.

### Step 6 — Hand off (ALWAYS include a clickable open link)

Every scaffold response **must** end with a clickable `file://` URL that opens the prototype directly. This is mandatory — not optional formatting. The user expects to one-click-open every generated prototype.

Format (use exactly this layout — bold "Open:" line first, then the file:// URL on its own line as a markdown link):

```
**Prototype written:** `openspec/changes/<change>/prototypes/<name>/vN.html`

**Open:** [vN.html](file:///absolute/path/to/openspec/changes/<change>/prototypes/<name>/vN.html)

_Alt — local server:_
```bash
python3 -m http.server 8765 --directory openspec/changes/<change>/prototypes/<name>
# then http://localhost:8765/vN.html
```
```

Rules:
- The `file://` URL **must be absolute** (resolve from the worktree / project root). Relative paths break clickability.
- Use the markdown link form `[label](file://…)` so the terminal renders it as clickable.
- If multiple prototypes were generated in one turn, list one `Open:` link per prototype — never a single combined link.
- Never omit the link, even if the user already asked to open it themselves.

Then stop. Wait for user feedback before iterating.

### Step 7 — Iterate

When user gives feedback:
- Confirm what changes vs the prior version.
- Bump to `v(N+1).html`. **Copy** `vN.html` as starting point, apply edits, write new file.
- Never edit the prior version in place.

### Step 8 — Finalize

When the user marks a version as "this is it" / "ready" / "let's build this":
- Do **not** auto-promote to a real route — that's a separate task gated by the OpenSpec proposal.
- Optionally add a `README.md` in the prototype folder pointing to the chosen version (e.g. *"v4 is the approved design; see design.md §X"*).
- Leave all versions in place — they archive together with the change.

## Quick reference

| Situation | Action |
|---|---|
| New prototype, folder missing | Create dir + `v1.html` |
| Folder exists | Next `vN.html`, copy from latest |
| User says "tweak" or "iterate" | New `vN.html`, never edit prior |
| User says "scrap and restart" | Confirm, then new `vN.html` from a fresh shell (not prior) |
| Ambiguous change folder | Ask user — never guess |
| No active OpenSpec change | Halt, suggest `/opsx:propose` |
| Real-data fidelity needed | Use real route under `_auth/` instead; this skill is for sketch-grade only |
| Token block looks outdated | Re-read `tokens.css` and replace the `<style>` block |

## Common mistakes

| Mistake | Fix |
|---|---|
| Overwriting `vN.html` | Never. Bump to `v(N+1).html` and copy first. |
| Inventing a change folder | Halt and ask user which change this belongs to. |
| Linking to real API / `/api/...` | Prototypes have inline mock data only. Zero fetches. |
| Using `apps/orchestrator/...` components via npm | Prototypes are framework-free HTML. Re-implement the visual with plain `<div>` + Tailwind classes. |
| Hard-coding token values (e.g. `#266b5e`) | Use Tailwind arbitrary values referencing the token vars (`bg-[--color-primary]`). |
| Skipping the `tokens.css` re-read | Always read fresh — that's the whole point of no static template. |
| Pulling random font / icon CDNs | Stick to fontsource Geist + lucide. Match prod stack. |
| Promoting prototype to a real route without an OpenSpec gate | Don't. Promotion is a separate task tied to spec approval. |

## Red flags

- "Just edit v1.html, the user won't notice" → No. Version history IS the conversation. Bump.
- "Let me wire it to the real API for fidelity" → No. Wrong skill. Use a real `_auth/` route.
- "I'll skip the OpenSpec change lookup — user knows where it goes" → No. Always confirm the change folder.
- "Multiple prototypes share one folder" → No. One screen per prototype-name folder. Versions stack within.
- "I'll just copy the tokens I remember instead of re-reading the file" → No. Always re-read `tokens.css` so prototypes track current design.
- "User can `cd` to the file themselves" → No. Always print the absolute `file://` link as a clickable markdown link. Mandatory in every scaffold response.
- "I'll combine all prototype links into one line" → No. One `Open:` line per prototype, each its own clickable link.

## Cross-references

- Memory: `feedback_html_prototyping.md` (this skill is its operationalization).
- Memory: `feedback_worktree_docker.md` (don't touch docker for prototypes — they're static HTML).
- AGENTS: `apps/orchestrator/AGENTS.md` §UI for the styling vocabulary the prototypes mirror.
- Tokens: `apps/orchestrator/src/styles/tokens.css` is the single source of truth — always re-read at scaffold time.
