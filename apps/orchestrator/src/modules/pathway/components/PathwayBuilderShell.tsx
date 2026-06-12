import { useNavigate } from '@tanstack/react-router'
import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { sortByOrd } from '@/lib/utils/ordinal'

import { LANE_ROW_HEIGHT } from '../canvasLayout'
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
import { useBuilderState, type BuilderAction } from '../useBuilderState'
import { useCollapsedSidebar } from '../useCollapsedSidebar'
import { createBlock } from '../utils/createBlock'
import { defaultLaneKindCode } from '../utils/laneRules'
import { findSelectedBlock } from '../utils/selection'

import { BuilderCanvasFrame } from './canvas/BuilderCanvasFrame'
import { BuilderFlushProvider } from './canvas/BuilderFlushContext'
import { DeletePathwayDialog } from './DeletePathwayDialog'
import { BuilderDock } from './dock/BuilderDock'
import { BuilderDrawer } from './drawer/BuilderDrawer'
import { EdgeInspector } from './drawer/EdgeInspector'
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

  const { phases, lanes, blocks, edges, timingValues, branches } = useMemo(
    () => ({
      phases: state.version.phases ?? [],
      lanes: state.version.lanes ?? [],
      blocks: state.version.blocks ?? [],
      edges: state.version.edges ?? [],
      timingValues: state.version.timing_values ?? [],
      branches: state.version.branches ?? [],
    }),
    [state.version],
  )

  // Pathway-completion § C2: clicking a dock tile adds the block in the
  // first phase on the kind's default lane; position is computed by the
  // auto-layout pass (authored x/y are placeholders the layout ignores).
  // § C2.3 swaps this direct-add for the BlockDialog add-mode flow.
  const onAddBlock = useCallback(
    (blockType: PathwayBlockType) => {
      const preferredCode = defaultLaneKindCode(blockType)
      const defaultLane = lanes.find((l) => l.lane_kind_code === preferredCode)
      if (!defaultLane) {
        toast.error(t('canvas.invalidLaneDrop'))
        return
      }
      const firstPhase = sortByOrd(phases)[0]
      if (!firstPhase) {
        toast.error(t('canvas.needPhaseFirst'))
        return
      }
      dispatch({
        type: 'add-block',
        block: createBlock({
          blockType,
          phaseId: firstPhase.id,
          laneId: defaultLane.id,
          x: 70,
          y: LANE_ROW_HEIGHT / 2 - 32,
        }),
      })
    },
    [lanes, phases, dispatch, t],
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

  const selectedBlock = findSelectedBlock(state.selection, blocks)
  const selectedBlockType =
    catalogue.find((c) => selectedBlock && c.type === legacyBlockType(selectedBlock)) ?? null
  const selectedBlockLane = lanes.find((l) => l.id === selectedBlock?.lane_id) ?? null
  const selectedBlockBranches = selectedBlock
    ? branches.filter((b) => b.block_id === selectedBlock.id)
    : []
  const selectedEdge = (() => {
    const sel = state.selection
    if (sel.kind !== 'edge') return null
    // `DerivedEdge` has no row id (slot #2 §3 — edges are computed
    // from `input_logic`); reuse the synthetic id `useFlowEdges`
    // composes from the producer / consumer / predicate triple.
    return (
      edges.find(
        (e) =>
          `${e.source_block_id ?? 'marker'}->${e.target_block_id}:${e.predicate}` === sel.edgeId,
      ) ?? null
    )
  })()

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
          />
          <BuilderDock catalogue={catalogue} onAddBlock={onAddBlock} />
          {selectedBlock && (
            <BuilderDrawer
              block={selectedBlock}
              blockType={selectedBlockType}
              lane={selectedBlockLane}
              blocks={blocks}
              branches={selectedBlockBranches}
              currentPathwayId={pathway.id}
              onPatchConfig={(config) =>
                dispatch({
                  type: 'patch-block',
                  blockId: selectedBlock.id,
                  // Slot #2 §6: typed fields live on the block
                  // envelope directly; spread the per-kind config
                  // bag back over the block so inspectors keep
                  // editing their familiar shape.
                  patch: config as Record<string, unknown>,
                })
              }
              onRename={(label) =>
                dispatch({
                  type: 'patch-block',
                  blockId: selectedBlock.id,
                  patch: { name: label || '' },
                })
              }
              onClose={() => dispatch({ type: 'select', selection: { kind: 'none' } })}
              onDelete={() => dispatch({ type: 'delete-block', blockId: selectedBlock.id })}
            />
          )}
          {selectedEdge && (
            <EdgeInspector
              edge={selectedEdge}
              onClose={() => dispatch({ type: 'select', selection: { kind: 'none' } })}
            />
          )}
        </BuilderFlushProvider>
      </main>
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
