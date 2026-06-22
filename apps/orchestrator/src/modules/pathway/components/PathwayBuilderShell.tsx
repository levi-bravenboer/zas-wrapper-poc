import { useNavigate } from '@tanstack/react-router'
import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { sortByOrd } from '@/lib/utils/ordinal'

import { useAutosavePathway } from '../hooks/useAutosavePathway'
import { useBuilderKeyboard } from '../hooks/useBuilderKeyboard'
import type { ReadOnlyVariant } from '../hooks/useResolvedVersion'
import {
  legacyBlockType,
  type PathwayBare,
  type PathwayBlockType,
  type PathwayEdgeOffsetDirection,
  type PathwayEdgeTimingKind,
  type PathwayPhase,
  type PathwayPhaseTemplate,
  type PathwayVersionDefinition,
} from '../types'
import {
  blocksInPhase,
  dependentBlocks,
  useBuilderState,
  type BuilderAction,
} from '../useBuilderState'
import { useCollapsedSidebar } from '../useCollapsedSidebar'
import { createBlock } from '../utils/createBlock'
import { defaultLaneKindCode } from '../utils/laneRules'
import { findSelectedBlock } from '../utils/selection'

import { BuilderCanvasFrame } from './canvas/BuilderCanvasFrame'
import { BuilderFlushProvider } from './canvas/BuilderFlushContext'
import { DeletePathwayDialog } from './DeletePathwayDialog'
import { BlockDialog, type BlockDraft } from './dialog/BlockDialog'
import { ConfirmDeleteBlockDialog } from './dialog/ConfirmDeleteBlockDialog'
import { ConfirmDeletePhaseDialog } from './dialog/ConfirmDeletePhaseDialog'
import { BuilderDock } from './dock/BuilderDock'
import { GeschiedenisDrawer } from './drawer/GeschiedenisDrawer'
import { ReadOnlyBanner } from './shell/ReadOnlyBanner'
import { BuilderSubbar } from './subbar/BuilderSubbar'
import { BuilderTopbar } from './topbar/BuilderTopbar'
import { ForkOnEditDialog } from './version/ForkOnEditDialog'
import { PublishDialog } from './version/PublishDialog'

type Props = {
  pathway: PathwayBare
  version: PathwayVersionDefinition
  isReadOnly: boolean
  readOnlyVariant: ReadOnlyVariant | null
  catalogue: PathwayBlockType[]
  phaseTemplates: PathwayPhaseTemplate[]
  timingKinds: PathwayEdgeTimingKind[]
  offsetDirections: PathwayEdgeOffsetDirection[]
}

export function PathwayBuilderShell({
  pathway,
  version,
  isReadOnly,
  readOnlyVariant,
  catalogue,
  phaseTemplates,
  timingKinds,
  offsetDirections,
}: Props): ReactElement {
  useCollapsedSidebar()
  return (
    <ReactFlowProvider>
      <Inner
        pathway={pathway}
        version={version}
        isReadOnly={isReadOnly}
        readOnlyVariant={readOnlyVariant}
        catalogue={catalogue}
        phaseTemplates={phaseTemplates}
        timingKinds={timingKinds}
        offsetDirections={offsetDirections}
      />
    </ReactFlowProvider>
  )
}

const READ_ONLY_PASSTHROUGH: ReadonlySet<BuilderAction['type']> = new Set([
  'select',
  'undo',
  'redo',
  'reset',
  'mark-saved',
])

function Inner({
  pathway,
  version,
  isReadOnly,
  readOnlyVariant,
  catalogue,
  phaseTemplates,
  // `timingKinds` / `offsetDirections` previously fed the
  // `EdgeInspector` timing union; retired in slot #2 §3. Slot #4
  // re-introduces them on the `TimingPolicy` inspector.
  timingKinds: _timingKinds,
  offsetDirections: _offsetDirections,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const navigate = useNavigate()
  const { state, dispatch: rawDispatch, isDirty } = useBuilderState(version)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [forkOnEditOpen, setForkOnEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const dispatch = useCallback(
    (action: BuilderAction) => {
      if (isReadOnly && !READ_ONLY_PASSTHROUGH.has(action.type)) {
        if (readOnlyVariant === 'published-fallback') setForkOnEditOpen(true)
        return
      }
      rawDispatch(action)
    },
    [isReadOnly, rawDispatch, readOnlyVariant],
  )

  const { saveState, flush, onRename } = useAutosavePathway({
    pathway,
    version: state.version,
    dispatch,
    isDirty: isDirty && !isReadOnly,
  })

  useBuilderKeyboard({ flush, dispatch })

  const { phases, lanes, blocks, edges, timingValues } = useMemo(
    () => ({
      phases: state.version.phases ?? [],
      lanes: state.version.lanes ?? [],
      blocks: state.version.blocks ?? [],
      edges: state.version.edges ?? [],
      timingValues: state.version.timing_values ?? [],
    }),
    [state.version],
  )

  // Pathway-completion § C2.3: clicking a dock tile opens the block
  // dialog in add mode. The block only exists once the author submits.
  const [pendingAddType, setPendingAddType] = useState<PathwayBlockType | null>(null)
  // § C5.2: delete goes through a confirm dialog enumerating dependents.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  // Phase delete also confirms, enumerating the blocks cascade-removed with it.
  const [pendingDeletePhaseId, setPendingDeletePhaseId] = useState<string | null>(null)

  const onAddBlock = useCallback(
    (blockType: PathwayBlockType) => {
      const firstPhase = sortByOrd(phases)[0]
      if (!firstPhase) {
        toast.error(t('canvas.needPhaseFirst'))
        return
      }
      const preferredCode = defaultLaneKindCode(blockType)
      if (!lanes.some((l) => l.lane_kind_code === preferredCode)) {
        toast.error(t('canvas.invalidLaneDrop'))
        return
      }
      setPendingAddType(blockType)
    },
    [lanes, phases, t],
  )

  const onSubmitAdd = useCallback(
    (draft: BlockDraft) => {
      if (!pendingAddType) return
      const base = createBlock({
        blockType: pendingAddType,
        phaseId: draft.phaseId,
        laneId: draft.laneId,
        // Sentinel (0, 0) = "no manual position yet" — the § C3
        // auto-layout pass owns placement until the author drags
        // the block to a new spot.
        x: 0,
        y: 0,
      })
      dispatch({
        type: 'add-block',
        block: {
          ...base,
          ...draft.config,
          name: draft.name || pendingAddType.label,
          input_logic: draft.inputLogic,
          timing_policy: draft.timingPolicy,
          participant: draft.participant,
        } as typeof base,
      })
      // add-block auto-selects the new block, which would immediately
      // pop the edit dialog — clear the selection so the author lands
      // back on the canvas after "Voeg toe".
      dispatch({ type: 'select', selection: { kind: 'none' } })
      setPendingAddType(null)
    },
    [pendingAddType, dispatch],
  )

  const onSubmitEdit = useCallback(
    (blockId: string, draft: BlockDraft) => {
      dispatch({
        type: 'patch-block',
        blockId,
        patch: {
          ...draft.config,
          name: draft.name,
          phase_id: draft.phaseId,
          lane_id: draft.laneId,
          input_logic: draft.inputLogic,
          timing_policy: draft.timingPolicy,
          participant: draft.participant,
        } as Record<string, unknown>,
      })
      dispatch({ type: 'select', selection: { kind: 'none' } })
    },
    [dispatch],
  )

  const onJumpToPhase = useCallback((_phaseId: string) => {
    // PoC: rely on default fit; viewport jumping deferred.
  }, [])

  const onAddPhase = useCallback(
    (template: PathwayPhaseTemplate | null, customLabel?: string) => {
      const nextOrd = Math.max(0, ...phases.map((p) => p.ord)) + 10
      const phase: PathwayPhase = {
        id: crypto.randomUUID(),
        template_id: template?.id ?? null,
        label: template?.label ?? customLabel?.trim() ?? t('subbar.customPhase'),
        ord: nextOrd,
        width_px: 380,
      }
      dispatch({ type: 'add-phase', phase })
    },
    [phases, dispatch, t],
  )

  const onRenamePhase = useCallback(
    (phaseId: string, label: string) => {
      dispatch({ type: 'rename-phase', phaseId, label })
    },
    [dispatch],
  )

  const selectedBlock = findSelectedBlock(state.selection, blocks)
  const selectedBlockType =
    catalogue.find((c) => selectedBlock && c.type === legacyBlockType(selectedBlock)) ?? null
  return (
    <div
      data-slot="pathway-builder-shell"
      data-readonly={isReadOnly ? 'true' : undefined}
      className={
        // `flex-1 min-h-0` lets the shell fill the SidebarInset's remaining
        // flex space (breadcrumbs already consumed their slice). `h-[100dvh]`
        // would push the page past the viewport and re-introduce the body
        // scroll bug.
        isReadOnly
          ? 'is-readonly grid min-h-0 flex-1 grid-rows-[var(--builder-row-topbar)_auto_var(--builder-row-subbar)_1fr]'
          : 'grid min-h-0 flex-1 grid-rows-[var(--builder-row-topbar)_var(--builder-row-subbar)_1fr]'
      }
    >
      <BuilderTopbar
        pathway={pathway}
        version={state.version}
        isReadOnly={isReadOnly}
        blockCount={blocks.length}
        phaseCount={phases.length}
        saveState={saveState}
        canUndo={!!state.history.past.length}
        canRedo={!!state.history.future.length}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onPublish={() => setPublishOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onRename={onRename}
      />
      {isReadOnly && readOnlyVariant && (
        <ReadOnlyBanner pathwayId={pathway.id} version={state.version} variant={readOnlyVariant} />
      )}
      <BuilderSubbar
        phases={phases}
        templates={phaseTemplates}
        onJumpToPhase={onJumpToPhase}
        onAddPhase={onAddPhase}
        onReorderPhase={(phaseId, toIndex) => dispatch({ type: 'reorder-phase', phaseId, toIndex })}
        onRenamePhase={onRenamePhase}
        onRequestDeletePhase={setPendingDeletePhaseId}
      />
      <main role="main" className="relative min-h-0 overflow-hidden">
        <BuilderFlushProvider flush={flush} saveState={saveState}>
          <BuilderCanvasFrame
            phases={phases}
            lanes={lanes}
            blocks={blocks}
            edges={edges}
            timingValues={timingValues}
            blockTypes={catalogue}
            selection={state.selection}
            dispatch={dispatch}
            onRequestDeleteBlock={setPendingDeleteId}
          />
          <BuilderDock catalogue={catalogue} onAddBlock={onAddBlock} />
          {pendingAddType && (
            <BlockDialog
              open
              mode="add"
              blockType={pendingAddType}
              block={null}
              phases={phases}
              lanes={lanes}
              blocks={blocks}
              currentPathwayId={pathway.id}
              onSubmit={onSubmitAdd}
              onClose={() => setPendingAddType(null)}
            />
          )}
          {selectedBlock && selectedBlockType && (
            <BlockDialog
              // Remount per block so the draft re-initialises.
              key={selectedBlock.id}
              open
              mode="edit"
              blockType={selectedBlockType}
              block={selectedBlock}
              phases={phases}
              lanes={lanes}
              blocks={blocks}
              currentPathwayId={pathway.id}
              onSubmit={(draft) => onSubmitEdit(selectedBlock.id, draft)}
              onDelete={() => setPendingDeleteId(selectedBlock.id)}
              onClose={() => dispatch({ type: 'select', selection: { kind: 'none' } })}
            />
          )}
          {pendingDeleteId &&
            (() => {
              const target = blocks.find((b) => b.id === pendingDeleteId)
              if (!target) return null
              return (
                <ConfirmDeleteBlockDialog
                  open
                  block={target}
                  dependents={dependentBlocks(blocks, pendingDeleteId)}
                  blockTypes={catalogue}
                  onConfirm={() => {
                    dispatch({ type: 'delete-block', blockId: pendingDeleteId })
                    setPendingDeleteId(null)
                  }}
                  onClose={() => setPendingDeleteId(null)}
                />
              )
            })()}
        </BuilderFlushProvider>
      </main>
      {pendingDeletePhaseId &&
        (() => {
          const target = phases.find((p) => p.id === pendingDeletePhaseId)
          if (!target) return null
          return (
            <ConfirmDeletePhaseDialog
              open
              phase={target}
              blocks={blocksInPhase(blocks, pendingDeletePhaseId)}
              onConfirm={() => {
                dispatch({ type: 'delete-phase', phaseId: pendingDeletePhaseId })
                setPendingDeletePhaseId(null)
              }}
              onClose={() => setPendingDeletePhaseId(null)}
            />
          )
        })()}
      <GeschiedenisDrawer open={historyOpen} onOpenChange={setHistoryOpen} pathwayId={pathway.id} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} pathwayId={pathway.id} />
      <DeletePathwayDialog
        pathwayId={pathway.id}
        pathwayName={pathway.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          void navigate({ to: '/pathways' })
        }}
      />
      <ForkOnEditDialog
        open={forkOnEditOpen}
        onOpenChange={setForkOnEditOpen}
        pathwayId={pathway.id}
        sourceVersionId={version.id}
      />
    </div>
  )
}
