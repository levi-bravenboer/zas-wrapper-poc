# Builder Canvas — Component Inventory

Living React-component map for Phase 3 implementation. This is the **HOW (React tree)** companion to `builder-ui-spec.md` (the **WHAT/LOOK per element**), itself derived from `builder-canvas-prototype.html` and decisions D21–D29 in `design.md`.

**Read order.** `design.md` (why) → `builder-ui-spec.md` (what + look + behavior per element for the canvas) → `overview-ui-spec.md` (what + look for the overview list and create-pathway dialog) → this doc (React component names, props, file paths, build sequence) → `specs/pathway-builder/spec.md` (testable requirements with scenarios).

**Scope.** Frontend only (`apps/orchestrator/src/modules/pathway/`). Each component lists: file path, props, key children, behavior, tokens / design-system pieces it leans on, open questions. All component names are placeholders — rename freely during implementation if a closer match exists in shadcn or existing modules.

**Stack baseline.**
- React 19 + TS strict, TanStack Router/Query, react-i18next, Tailwind v4 + CSS custom properties, shadcn primitives (sidebar, button, popover, drawer, dialog, dropdown-menu, avatar, tooltip).
- Canvas: `@xyflow/react` 12.x (D5). Controlled state.
- Form renderer: `@rjsf/core` (per task 3.11, library audit gate first).

---

## 1. Route + shell

### `PathwayBuilderPage`
- **Path:** `apps/orchestrator/src/routes/_auth/pathways/$pathwayId.tsx`
- **Props:** none (TanStack Router file route; reads `pathwayId` from params)
- **Responsibility:** Hydrate `usePathway(id)` + `usePathwayBlocks()` + `usePathwayPhaseTemplates()`; render `<PathwayBuilderShell>`; centralize dirty-state context.
- **Open:** suspense boundary vs route loader pre-fetch.

### `PathwayBuilderShell`
- **Path:** `modules/pathway/components/PathwayBuilderShell.tsx`
- **Props:** `{ pathway: Pathway; catalogue: PathwayBlockType[]; phaseTemplates: PathwayPhaseTemplate[] }`
- **Layout:** 3-row grid per D21 (`64px 44px 1fr`).
- **Children:** `<BuilderTopbar>`, `<BuilderSubbar>`, `<BuilderCanvasFrame>`, `<BuilderDock>` (absolute, bottom), `<BuilderDrawer>` (absolute, right), `<MinimapZoomPanel>` (absolute, bottom-right).
- **Collapsed sidebar:** sets `sidebarCollapsed` once on mount; restores on unmount.

---

## 2. Topbar (D28)

### `BuilderTopbar`
- **Path:** `modules/pathway/components/topbar/BuilderTopbar.tsx`
- **Props:** `{ pathway: Pathway; saveState: 'clean' | 'dirty' | 'error' | 'saving'; onSave(): void; onUndo(): void; onRedo(): void; canUndo: boolean; canRedo: boolean; presence: PresenceUser[] }`
- **Children, left → right:**
  - `<PathwayIdTile>` — 32px gradient tile (teal→mint), workflow icon, decorative.
  - `<PathwayIdentityStack>` — vertical stack:
    - `<Crumbs>` — eyebrow (`Zorgpaden / {name}`, uppercase first crumb).
    - `<TitleRow>` — `<EditableTitle>` + pencil icon trigger + `<MetaLine>` (`9 blokken · 4 fasen · bewerkt 13:24`).
  - `<SaveStatusPill>` — slim outline pill, pulsing dot when dirty (`@keyframes pulseDot`).
  - `<Spacer>`.
  - `<PresenceStack>` — overlapping avatars (shadcn `Avatar` × N + `+overflow` chip).
  - `<TopbarDivider>` — 1×22 hairline.
  - `<HistoryGroup>` — undo + redo icon-buttons.
  - `<HistoryButton>` — ghost button, `Geschiedenis` label.
  - `<SaveButton>` — primary, `--gradient-active` background, save icon.
- **Tokens:** `--gradient-aurora` bleed at bottom, `backdrop-filter: blur(10px) saturate(140%)`, `--hairline` border.

### `EditableTitle`
- **Path:** `…/topbar/EditableTitle.tsx`
- **Props:** `{ value: string; onCommit(next: string): void }`
- **Behavior:** click or pencil-icon → inline `<input>` with auto-width, blur or Enter commits, Esc reverts.

### `SaveStatusPill`
- **Props:** `{ state: 'clean' | 'dirty' | 'error' | 'saving' }`
- **Variants:** `is-clean` (success), `is-dirty` (warn, animated dot), `is-error` (danger), `is-saving` (mute, spinner replaces dot).
- **i18n keys:** `pathway.status.{clean|dirty|error|saving}`.

### `PresenceStack`
- **Props:** `{ users: PresenceUser[]; max?: number }` (`max` default 3)
- **Behavior:** renders first N avatars, overflow chip `+N`. Tooltip on hover with full names.
- **Open:** presence backend not in scope for PoC — props ship optional, component renders nothing if empty.

---

## 3. Subbar — phase timeline (D29)

### `BuilderSubbar`
- **Path:** `modules/pathway/components/subbar/BuilderSubbar.tsx`
- **Props:** `{ phases: PathwayPhase[]; onJumpToPhase(phaseId: string): void; onAddPhase(): void }`
- **Children:**
  - `<SubbarLabel>` — small uppercase `SPRING NAAR` label.
  - `<PhaseAnchor>` × N — `[idx] Label`, chevron separator between, click scrolls canvas to that phase's column.
  - `<AddPhaseTrigger>` — `+ Fase`, ghost button, opens `<PhasePickerPopover>`.

### `PhasePickerPopover`
- **Path:** `modules/pathway/components/subbar/PhasePickerPopover.tsx`
- **Props:** `{ templates: PathwayPhaseTemplate[]; onPick(template: PathwayPhaseTemplate | null): void }` (`null` = custom)
- **Children:** list of templates + a `Custom phase` row at the bottom. Selecting custom opens a tiny inline input for label.

---

## 4. Canvas frame (D21–D26)

### `BuilderCanvasFrame`
- **Path:** `modules/pathway/components/canvas/BuilderCanvasFrame.tsx`
- **Props:** `{ pathway: Pathway; selection: BuilderSelection; onSelectionChange(next: BuilderSelection): void; onChange(next: Pathway): void }`
- **Behavior:** hosts the xyflow `<ReactFlow>` instance in controlled mode. Renders the underlay (phase columns + lane rows) as a custom background layer (`<BackgroundLayers>`), overlays xyflow nodes on top.
- **Viewport:** initial fit-to-content, min zoom 0.4, max zoom 2.0.

### `BackgroundLayers`
- **Path:** `…/canvas/BackgroundLayers.tsx`
- **Children:**
  - `<PhaseColumns>` — one `<PhaseColumn>` per phase (full-height tinted band + sticky `<PhaseHeader>` chip).
  - `<LaneRows>` — one `<LaneRow>` per lane (full-width band + sticky `<LaneLabel>` chip).
- **Renders below** xyflow node layer.

### `PhaseColumn`
- **Props:** `{ phase: PathwayPhase; index: number; rangeXStart: number; rangeXEnd: number }`
- **Sets** `--ph-soft` and `--ph-ink` custom properties on its root so the header chip + numbered badge inherit phase tint.

### `LaneRow`
- **Props:** `{ lane: PathwayLane; index: number; topY: number; height: number }`
- **Sets** `--lane-accent` custom property (cascades to every block in the row).

### `LaneLabel`
- **Props:** `{ lane: PathwayLane; blockCount: number }`
- **Behavior:** `position: sticky; left: 12px;`, glass chip with lane icon + name + count.

---

## 5. Node — block card (D27)

### `BlockNode` (xyflow custom node)
- **Path:** `modules/pathway/components/canvas/nodes/BlockNode.tsx`
- **Props (xyflow shape):** `{ data: BlockNodeData; selected: boolean }`
- **`BlockNodeData`:** `{ block: PathwayBlock; blockType: PathwayBlockType; lane: PathwayLane; isEntry: boolean; isDirty: boolean }`
- **DOM grid:** `4px 36px 1fr` columns × `auto`.
- **Children:**
  - `<RailBar>` — left lane-accent strip.
  - `<IcoTile>` — 28px lane-tinted square with block-type icon (lucide map by type).
  - `<BlockName>` — single-line truncate.
  - `<BlockMeta>` — `{type} · {duration-chip}` (uses `<DayChip>`).
  - `<EntryCornerTab>` — only when `isEntry`, top-left corner-tab with `START`.
  - `<HandlePort type="target" position="left" />` — single in-port.
  - `<HandlePort type="source" position="right" />` — single out-port (for non-branch types).

### `BranchBlockNode` (variant for `decision`)
- **Replaces** the single out-port with two `<HandlePort>` children:
  - `id="yes"` at `top: 28%` (rendered as `out-yes`).
  - `id="no"` at `top: 72%` (rendered as `out-no`).
- **Dashed border** (`border-style: dashed`) to distinguish branching from straight-through.

### `HandlePort`
- **Path:** `…/canvas/nodes/HandlePort.tsx`
- **Wraps** xyflow `<Handle>` with the project's `.port` styling (11px circle, lane-accent border, hover scale 1.25).

### `DayChip`
- **Path:** `…/canvas/nodes/DayChip.tsx`
- **Props:** `{ value: PathwayTimingValue | null }`
- **Renders:** `D0`, `D0+1`, `D+10`, `30 min`, `2u` depending on kind/unit; falls back to `—` if null.

---

## 6. Group node (D26)

### `BlockGroupNode` (xyflow custom node)
- **Path:** `modules/pathway/components/canvas/nodes/BlockGroupNode.tsx`
- **Props:** `{ data: BlockGroupData; selected: boolean }`
- **`BlockGroupData`:** `{ group: PathwayBlockGroup; lane: PathwayLane; phase: PathwayPhase; children: PathwayBlock[] }`
- **DOM:** dashed lane-tinted container, single in-port + single out-port (children are not edge-targets).
- **Children:**
  - `<GroupHeader>` — uppercase label + `<GroupCount>` (e.g. `4 stappen`) + `<DayChip>`.
  - `<GroupItem>` × children — `14px idx | 24px ico | 1fr name | auto type`.
- **Data-model dependency:** requires a `pathway_block_group` table + parent-of relation on `pathway_block`. **Not** in Phase 1 schema; design pass only. Phase 3 implementation either lands the migration alongside or stubs groups as a UI-only grouping (parked).

---

## 7. Edges (D24)

### `SmoothstepEdge`
- **Path:** `modules/pathway/components/canvas/edges/SmoothstepEdge.tsx`
- **Renders** as an xyflow custom edge.
- **Path generator:** orthogonal H/V segments with `Q` corner radius 8–10px; no marker-end (no arrowhead).
- **Variants:**
  - default — `#cbd1d8`, 1.75px.
  - `primary` — `--primary`, 2px (used for cross-phase OR branch-positive).
  - `dashed` — `#cbd1d8`, 1.75px, `stroke-dasharray: 6 4` (branch-negative).
- **Label:** optional `<EdgeLabel>` (delay text, e.g. `+1d`) rendered at the geometric midpoint of the longest straight segment.

### `EdgeLabel`
- **Props:** `{ text: string; x: number; y: number }`
- **Renders** as an SVG `<text>` with the project's `--muted-foreground` color.

---

## 8. Dock (block palette)

### `BuilderDock`
- **Path:** `modules/pathway/components/dock/BuilderDock.tsx`
- **Props:** `{ catalogue: PathwayBlockType[]; onAddBlock(type: PathwayBlockType): void }`
- **Behavior:** absolute, bottom-centered, glass card. Drag-from-dock to canvas OR click-to-add-at-viewport-center. Default lane assignment from `default_lane_kind_code` per D9.

### `DockItem`
- **Props:** `{ blockType: PathwayBlockType }`
- **Children:** type icon + label. Draggable: sets a drag image, dispatches `onDragStart` carrying the type code.

---

## 9. Drawer (per-block config editor)

### `BuilderDrawer`
- **Path:** `modules/pathway/components/drawer/BuilderDrawer.tsx`
- **Props:** `{ selection: BuilderSelection; onChange(next: BuilderSelection): void; onPatchBlock(blockId: string, patch: Partial<PathwayBlock>): void }`
- **Behavior:** slides in from right when `selection.kind === 'block'`; width ~360px; glass-strong background; close on Esc or X.

### `DrawerHeader`
- **Props:** `{ block: PathwayBlock; blockType: PathwayBlockType; lane: PathwayLane }`
- **Children:** block-type ico-tile + name + type-chip + lane-chip.

### `ConfigForm`
- **Path:** `…/drawer/ConfigForm.tsx`
- **Wraps** `@rjsf/core` against `blockType.config_schema`.
- **Custom widgets:** at minimum `DurationWidget` (binds `pathway_timing_value`) and `DeferredFieldWidget` (toggles `pathway_block_deferred_field` membership per field-path). Both live under `…/drawer/widgets/`.

### `DrawerFooter`
- **Props:** `{ onDelete(): void }`
- **Renders** delete-block trigger (with confirmation modal).

---

## 10. Minimap + zoom (D29)

### `MinimapZoomPanel`
- **Path:** `modules/pathway/components/minimap/MinimapZoomPanel.tsx`
- **Props:** `{ pathway: Pathway; viewport: BuilderViewport; onViewportChange(next: BuilderViewport): void }`
- **Children:**
  - `<MinimapCanvas>` — scaled-down dot map (one `.mm-dot` per block, colored by lane-accent), viewport rectangle overlay.
  - `<ZoomBar>` — `-` icon · `{pct}%` · `+` icon · `fit-to-screen` icon.
- **Behavior:** click on minimap recenters the viewport; drag the viewport rect to pan.

---

## 11. Toasts

### `BuilderToast`
- **Path:** existing orchestrator toast system reused (no new component); pathway module only contributes the `toast.success(t('pathway.save.success'))` / `toast.error(...)` calls on `useSavePathway` mutation callbacks.
- **i18n keys:** `pathway.save.success`, `pathway.save.error`, `pathway.delete.success`, etc.

---

## 12. State + hooks

### `pathwayKeys`
- **Path:** `modules/pathway/pathwayKeys.ts`
- **Surfaces:** `list()`, `detail(id)`, `blocks()`, `phaseTemplates()`. Already shipped in Phase 2.

### Hooks
- **Existing:** `usePathwayList`, `usePathway`, `useCreatePathway`, `usePathwayBlocks`, `usePathwayPhaseTemplates`.
- **New (Phase 3):**
  - `useSavePathway(pathwayId)` — `PUT /pathways/{id}` mutation, optimistic update + dirty-state clear.
  - `useDeletePathway(pathwayId)` — `DELETE /pathways/{id}` mutation.
  - `useBuilderState(initial: Pathway)` — local reducer that owns the controlled xyflow nodes/edges and the dirty flag; exposes `dispatch` + `selectors` + `history` (undo/redo).

### `BuilderState`
- **Shape:**
  ```ts
  type BuilderState = {
    pathway: Pathway;          // current editable copy
    baseline: Pathway;         // last-saved snapshot for dirty diff
    selection: BuilderSelection;
    history: { past: Pathway[]; future: Pathway[] };
  };
  type BuilderSelection =
    | { kind: 'none' }
    | { kind: 'block'; blockId: string }
    | { kind: 'edge'; edgeId: string }
    | { kind: 'group'; groupId: string };
  ```
- **Dirty derive:** `!deepEqual(pathway, baseline)`.
- **History limit:** 50 past / 50 future entries.

---

## 13. i18n

All user-facing strings live under the `pathway` namespace (`apps/orchestrator/src/locales/nl/pathway.json` already exists from Phase 2). New keys for Phase 3:

- `builder.topbar.history`, `builder.topbar.save`, `builder.topbar.undo`, `builder.topbar.redo`
- `builder.status.{clean|dirty|error|saving}`
- `builder.subbar.jumpTo`, `builder.subbar.addPhase`, `builder.subbar.customPhase`
- `builder.dock.searchPlaceholder`, `builder.dock.dragHint`
- `builder.drawer.delete`, `builder.drawer.deleteConfirmTitle`, `builder.drawer.deleteConfirmBody`
- `builder.minimap.fit`, `builder.minimap.zoomIn`, `builder.minimap.zoomOut`
- `builder.entry.badge` (`START`)
- `builder.group.steps` (`{count} stappen`)

en/fr locales not populated in repo (per nl-only policy from Phase 2).

---

## 14. Token additions

Append to `apps/orchestrator/src/styles/tokens.css` (or wherever existing tokens live):

- `--ph-1 / --ph-1-soft / --ph-1-ink` … through `--ph-4-*` (phase tints).
- `--lane-patient / --lane-caregiver / --lane-system / --lane-external` (lane accents — caregiver = primary, patient = blue, system = violet, external = orange).
- `--gradient-active` already exists; verify it is exported from the shared token sheet.
- `--shadow-xs / --shadow-sm` already exist.
- Hairline / muted / success / warn / danger pulled from existing orchestrator tokens — no new entries needed.

---

## 15. Out of scope (PoC)

The prototype showcases concepts that are **explicitly deferred** for the base change:

- Real-time presence — `PresenceStack` props are stubbed.
- Smart time tape — D13 defers; no component planned.
- Block groups — UX locked (D26) but data-model migration parked; Phase 3 either lands the table or ships groups as UI-only clusters.
- Versiegeschiedenis (history) drawer — button exists, no implementation.
- Multi-owner pathways — single owner only (overview-ui-spec.md §11).

Note: autosave is **in scope** for `concept` pathways per D31 (component `useConceptAutosave`, §17).

---

## 16. Overview surface + create flow

Renders at `/pathways`. Spec source: `overview-ui-spec.md`.

### `PathwayOverviewPage`
- **Path:** `apps/orchestrator/src/routes/_auth/pathways/index.tsx`
- **Responsibility:** Hydrate `usePathwayList()`; render `<PathwayOverviewShell>` with state-derived child.
- **State machine:** `OverviewState = 'loading' | 'error' | 'ready-empty' | 'ready'`.

### `PathwayOverviewShell`
- **Path:** `modules/pathway/components/overview/PathwayOverviewShell.tsx`
- **Props:** `{ state: OverviewState; pathways?: PathwaySummary[]; error?: Error; onRetry(): void }`
- **Children:** `<OverviewPageHeader>` always; one of `<OverviewLoading>` / `<OverviewError>` / `<OverviewEmpty>` / `<PathwayList>`.

### `OverviewPageHeader`
- **Props:** `{ pathwayCount: number; conceptCount: number; onCreate(): void }`
- **Tokens:** `--gradient-active` on Create button; sticky inside `<SidebarInset>`.

### `PathwayList`
- **Props:** `{ items: PathwaySummary[] }`
- **Children:** `<PathwayRow>` per item, ordered by `updated_at desc`.

### `PathwayRow`
- **Path:** `modules/pathway/components/overview/PathwayRow.tsx`
- **Props:** `{ pathway: PathwaySummary }`
- **Children:** `<PathwayIdentityTile size="md">`, identity stack (`<RowTitle>` + `<PathwayStatusBadge>` + `<RowMeta>`), spacer, `<OwnerAvatar>`, `<RowOverflowMenu>`.
- **Behavior:** entire row is an anchor to `/pathways/$id`; overflow menu and avatar tooltip stop event propagation.

### `PathwayStatusBadge`
- **Path:** `modules/pathway/components/shared/PathwayStatusBadge.tsx`
- **Props:** `{ status: 'concept' | 'published' | 'archived' }`
- **i18n keys:** `pathway.status.{concept|published|archived}`.
- **Tokens:** warn-tinted for concept, success-tinted for published, muted for archived (overview-ui-spec.md §3).
- **Used by:** `<PathwayRow>` AND `<BuilderTopbar>` (replaces previous status indicator in topbar header cluster).

### `OverviewEmpty`
- **Path:** `modules/pathway/components/overview/OverviewEmpty.tsx`
- **Props:** `{ onCreate(): void }`
- **Children:** large `<PathwayIdentityTile size="lg">` + title + body + primary CTA.

### `OverviewLoading`
- **Path:** `modules/pathway/components/overview/OverviewLoading.tsx`
- **Children:** three `<PathwayRowSkeleton>`s using shadcn `<Skeleton>`.

### `OverviewError`
- **Path:** `modules/pathway/components/overview/OverviewError.tsx`
- **Props:** `{ error: Error; onRetry(): void }`

### `CreatePathwayDialog`
- **Path:** `modules/pathway/components/CreatePathwayDialog.tsx` (REPLACE existing 3-field implementation).
- **Props:** `{ open: boolean; onOpenChange(open: boolean): void }`
- **Children:**
  - `<DialogHeader>` → `<PathwayIdentityTile size="lg">` + `<DialogEyebrow>` + `<DialogTitle>`.
  - `<DialogBody>` → 3 `<FormGroup>`s wrapping fields: `<NameField>`, `<ClinicalGoalField>`, `<PatientGoalField>`, `<PhasePresetRadioGroup>`, `<OwnerCombobox>`.
  - `<DialogFooter>` → `<CancelButton>` + `<SubmitButton>` (gradient-active, spinner-while-pending).
- **Hook:** `useCreatePathway()` (`POST /pathways`).
- **Side effects on success:** `queryClient.setQueryData(pathwayKeys.detail(id), data)` → `queryClient.invalidateQueries(pathwayKeys.list())` → `navigate({ to: '/pathways/$pathwayId', params: { pathwayId: id } })` → push toast.

### `PhasePresetRadioGroup`
- **Path:** `modules/pathway/components/create/PhasePresetRadioGroup.tsx`
- **Props:** `{ value: 'standard' | 'empty'; onChange(value): void }`
- **Behavior:** shadcn `<RadioGroup>` rendered as two side-by-side cards (overview-ui-spec.md §7).

### `OwnerCombobox`
- **Path:** `modules/pathway/components/create/OwnerCombobox.tsx`
- **Props:** `{ value: string; onChange(userId: string): void }`
- **Hook:** `useCaregivers()` (tenant-scoped).
- **Children:** shadcn `<Popover>` + `<Command>` with avatar + name per option.

### `PathwayIdentityTile` (shared)
- **Path:** `modules/pathway/components/shared/PathwayIdentityTile.tsx`
- **Props:** `{ size?: 'sm' | 'md' | 'lg'; className?: string }`
- **Used by:** `<PathwayRow>`, `<OverviewEmpty>`, `<BuilderTopbar>`, `<CreatePathwayDialog>` header.
- **Visual:** gradient `linear-gradient(135deg, primary@16%, mint@22%)`, border `primary@22%`, inner highlight, lucide `Workflow` icon.
- **Sizes:** sm=24/icon-12, md=32/icon-16, lg=40/icon-20.

---

## 17. Lifecycle additions (D30–D31)

### `useConceptAutosave`
- **Path:** `modules/pathway/hooks/useConceptAutosave.ts`
- **Signature:** `(pathwayId: string, status: PathwayStatus, builderState: BuilderState) => { autosaveState: 'clean' | 'pending-debounce' | 'saving' | 'error'; flush(): Promise<void> }`
- **Behavior:** debounces 800ms on state change; runs only when `status === 'concept'`; `flush()` cancels debounce and runs immediately. `⌘S` handler in `<BuilderTopbar>` calls `flush()`.

### `<SaveStatusPill>` (extend existing)
- **Add prop:** `mode: 'concept' | 'published'`.
- **Concept copy:** `pathway.status.concept.{clean|pendingDebounce|saving|error}` (`automatisch opgeslagen` / `niet opgeslagen` / `wijzigingen opslaan…` / `opslaan mislukt`).
- **Published copy:** existing `pathway.status.{clean|dirty|saving|error}`.

### `<PublishButton>`
- **Path:** `modules/pathway/components/topbar/PublishButton.tsx`
- **Props:** `{ pathwayId: string; disabled: boolean }`
- **Behavior:** disabled when autosave dirty or in flight; on click, force-flush via `useConceptAutosave().flush()`; on flush success, open `<PublishConfirmation>`; on flush failure, surface autosave error toast and abort.
- **Render gate:** only when `status === 'concept'` (replaces `<SaveButton>` in that mode).

### `<PublishConfirmation>`
- **Path:** `modules/pathway/components/topbar/PublishConfirmation.tsx`
- **Children:** shadcn `<AlertDialog>` with body explaining enrollment unlock; primary `Publiceren` button calls `usePublishPathway()` → `POST /pathways/{id}/publish`.

---

## 18. Empty-canvas additions (D34–D35)

### `<BuilderShellStateRenderer>`
- **Path:** `modules/pathway/components/BuilderShellStateRenderer.tsx`
- **Props:** `{ state: BuilderShellState; pathway?: Pathway; error?: Error; onRetry(): void }`
- **Renders:** one of `<BuilderLoading>` / `<BuilderNotFound>` / `<BuilderError>` / `<BuilderReadyEmpty>` / `<BuilderReadyPopulated>`. Topbar always renders (with identity + back link in failure modes).

### `<BuilderReadyEmpty>`
- **Children:** full chrome + `<BackgroundLayers>` (phases + lanes from scaffold) + `<EmptyCanvasCTA>`.

### `<EmptyCanvasCTA>`
- **Path:** `modules/pathway/components/canvas/EmptyCanvasCTA.tsx`
- **Props:** `{ scaffold: 'present' | 'absent'; earliestPhase?: PathwayPhase; earliestLane?: PathwayLane; onDropFromDock(blockType: string): void }`
- **Behavior:** dashed placeholder card with arrow + label; on drop, calls `onDropFromDock` and forces lane to `earliestLane.id` regardless of type defaults. When `scaffold === 'absent'`, renders centered prompt pointing at subbar `+ Fase`.

### `<BuilderNotFound>` / `<BuilderError>`
- Centered cards inside the canvas frame; carry `role="alert"` and back-to-overview + retry actions.

---

## 19. Version surface (D36–D41)

Components introduced by the version-resolution prototype work. All read the resolved version from the shell loader; none own version state directly.

### `<VersionSwitchChip>` (D39)
- **Path:** `modules/pathway/components/topbar/VersionSwitchChip.tsx`
- **Props:** `{ pathwayId: string; current: PathwayVersionSummary }`
- **Renders:** trigger button (dot · `v.{n}` · chev) + popover menu with `Werkversie` / `Gepubliceerd` groups + footer link to drawer.
- **Behavior:** routing via `useNavigate()` per `history-spec.md` §5a. Menu opens on click; closes on outside-click, Esc, or item pick. Trigger is excluded from the `.is-readonly` dim list (stays interactive for read-only escape).
- **Data:** `useVersionList(pathwayId)` (deferred to first menu open, then session-cached). Loading row uses `<Skeleton>`; error row falls back to footer-only.
- **a11y:** `aria-haspopup="menu"`, `aria-expanded`, `aria-label` includes current version + status. Menu items have `aria-current="true"` on active row. Keyboard nav implemented via shadcn `<DropdownMenu>` primitive.

### `<ReadOnlyBanner>` (D40)
- **Path:** `modules/pathway/components/shell/ReadOnlyBanner.tsx`
- **Props:** `{ variant: 'historical' | 'published-fallback'; version: PathwayVersionSummary; onRestore(): void; onFork(): void; onBackToCurrent?(): void }`
- **Renders:** 36px tinted strip with info-circle icon + body copy + action cluster. Variant selects tint + CTA label.
- **Behavior:** mounts when shell is read-only; calls `onFork` for fork-on-edit flow (with confirmation modal) and `onRestore` for restore flow (with confirmation modal). `onBackToCurrent` only rendered for historical variant when a current resolution exists.
- **a11y:** `role="status"`. CTA is a full `<button>` with descriptive label. Reduced motion: instant show, no slide-in.

### `<CrumbVersionMarker>` (D41)
- **Path:** `modules/pathway/components/topbar/CrumbVersionMarker.tsx`
- **Props:** `{ version: PathwayVersionSummary }`
- **Renders:** inline `<span>` with three children — colored dot · `v.{n}` · state word.
- **Behavior:** purely passive; not interactive. Color from same status palette as `<VersionSwitchChip>` dot and `<ReadOnlyBanner>` tint.
- **a11y:** `aria-hidden="true"` — `<VersionSwitchChip>` trigger already announces the same info.

### `<GeschiedenisDrawer>` (history layer drawer — see `history-spec.md` §2)
- **Path:** `modules/pathway/components/drawer/GeschiedenisDrawer.tsx`
- **Props:** `{ pathwayId: string; isOpen: boolean; onClose(): void }`
- **Renders:** version list reverse-chrono with per-row actions (`Bekijken`, `Herstellen`).
- **Mutex:** opening this drawer closes `<BuilderDrawer>` (block-config) and vice versa — shared drawer slot.
- **Entry point:** opened ONLY via `<VersionSwitchChip>` menu footer link. The standalone topbar `Geschiedenis` button from earlier drafts is REMOVED.
- **Hooks:** `useVersionList(pathwayId)`, `useRestoreVersion()`, `useForkVersion()`.

### `useResolvedVersion(pathwayId, versionId?)` (loader hook)
- **Path:** `modules/pathway/hooks/useResolvedVersion.ts`
- **Returns:** `{ pathway, version, isReadOnly, readOnlyVariant }` where `isReadOnly` and `readOnlyVariant` follow the §5 activation rule (read-only when URL has `/v/...` OR resolved version's status ≠ `concept`).
- Used by `PathwayBuilderShell` to drive `.main.is-readonly` class and choose banner variant.

### Routing additions
- `/pathways/$pathwayId` (existing) — loader calls `GET /pathways/{id}`; resolves to latest concept or latest published.
- `/pathways/$pathwayId/v/$versionId` (NEW) — loader calls `GET /pathways/{id}/versions/{versionId}`; 404 if `versionId` doesn't belong to `pathwayId`.
- Both routes mount the same `<PathwayBuilderShell>` — only the loader output differs. Read-only chrome is driven by `useResolvedVersion`, not by which route matched.

---

## 20. Build order (full sequence)

Replaces the earlier canvas-only sequence. Reads top-to-bottom; each step exercises its slice before the next builds on it.

**Phase A — shared + overview surface (before canvas internals).**

A1. `<PathwayIdentityTile>` shared (used by row, overview empty, builder topbar, dialog).
A2. `<PathwayStatusBadge>` shared (used by row + topbar).
A3. `<PathwayOverviewPage>` + `<PathwayOverviewShell>` + `<OverviewLoading>` + `<OverviewError>` + `<OverviewEmpty>` + `<PathwayList>` + `<PathwayRow>` — proves the read surface.
A4. `<CreatePathwayDialog>` (prettified, 5 fields) with cache pre-seed on success — proves create handoff.

**Phase B — canvas internals.**

B1. `PathwayBuilderShell` + `BackgroundLayers` (canvas fills, no nodes yet) — proves the layout grid.
B2. `<BuilderShellStateRenderer>` covering all five `BuilderShellState` branches — proves the matrix renders without throwing on empty/error paths.
B3. `BlockNode` + `HandlePort` + `useBuilderState` reducer (nodes only, no edges) — proves controlled state.
B4. `SmoothstepEdge` + `EdgeLabel` — proves routing.
B5. `BuilderDock` + `useAddBlock` interaction — proves catalogue-driven insertion.
B6. `BuilderDrawer` + `ConfigForm` — proves rjsf integration.
B7. `BuilderTopbar` (+ `SaveStatusPill` published variant) + `useSavePathway` — proves round-trip persistence.
B8. `BuilderSubbar` + `PhasePickerPopover` — proves phase mutation.
B9. `MinimapZoomPanel` — proves viewport sync.
B10. `BranchBlockNode` + branch-edge variants — proves decision flow.
B11. `BlockGroupNode` (if data model ready) — last, dependent on either migration or UI-only fallback decision.

**Phase C — lifecycle & onboarding.**

C1. `useConceptAutosave` + `<SaveStatusPill>` concept variant + `<PublishButton>` + `<PublishConfirmation>` — proves lifecycle.
C2. `<EmptyCanvasCTA>` with scaffold-present and scaffold-absent variants — proves first-block onboarding.

**Phase D — version surface (depends on backend `pathway_version` table).**

D1. `useResolvedVersion` loader hook + routing addition for `/pathways/$pathwayId/v/$versionId` — proves the loader contract from `history-spec.md` §5.
D2. `<CrumbVersionMarker>` — proves the passive version identity in crumbs (cheapest first, no popover).
D3. `<VersionSwitchChip>` (trigger + menu + footer link) — proves the topbar interactive surface; replaces the standalone `Geschiedenis` topbar button in B7.
D4. `<ReadOnlyBanner>` + shell `.is-readonly` wiring (dim list per `builder-ui-spec.md` §28) — proves read-only chrome.
D5. `<GeschiedenisDrawer>` (list + `Bekijken` action) + mutex with `<BuilderDrawer>` — proves drawer slot sharing.
D6. Restore + fork-on-edit flows (confirmation modals, `useRestoreVersion`, `useForkVersion`) — proves the version-creating transitions.
