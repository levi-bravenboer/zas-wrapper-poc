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
import type {
  PathwayBare,
  PathwayBlockType,
  PathwayEdgeOffsetDirection,
  PathwayEdgeTimingKind,
  PathwayPhase,
  PathwayPhaseTemplate,
  PathwayVersionDefinition,
} from '../types'
import { useBuilderState, type BuilderAction } from '../useBuilderState'
import { useCollapsedSidebar } from '../useCollapsedSidebar'
import { createBlock } from '../utils/createBlock'
import { defaultLaneKindCode } from '../utils/laneRules'
import { findSelectedBlock } from '../utils/selection'

import { BuilderCanvasFrame, type CanvasDropTarget } from './canvas/BuilderCanvasFrame'
import { BuilderFlushProvider } from './canvas/BuilderFlushContext'
import { useDragContext } from './canvas/useDragContext'
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
  timingKinds,
  offsetDirections,
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

  const dragApi = useDragContext()

  const { phases, lanes, blocks, edges, timingValues, timeMarkers, branches } = useMemo(
    () => ({
      phases: state.version.phases ?? [],
      lanes: state.version.lanes ?? [],
      blocks: state.version.blocks ?? [],
      edges: state.version.edges ?? [],
      timingValues: state.version.timing_values ?? [],
      timeMarkers: state.version.time_markers ?? [],
      branches: state.version.branches ?? [],
    }),
    [state.version],
  )

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

  const onDropBlockType = useCallback(
    (typeCode: string, target: CanvasDropTarget | null) => {
      const bt = catalogue.find((c) => c.type === typeCode)
      if (!bt) return
      if (!target) {
        onAddBlock(bt)
        return
      }
      dispatch({
        type: 'add-block',
        block: createBlock({
          blockType: bt,
          phaseId: target.phaseId,
          laneId: target.laneId,
          x: target.x,
          y: target.y,
        }),
      })
    },
    [catalogue, dispatch, onAddBlock],
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
  const selectedBlockType = catalogue.find((c) => c.type === selectedBlock?.type) ?? null
  const selectedBlockLane = lanes.find((l) => l.id === selectedBlock?.lane_id) ?? null
  const selectedBlockBranches = selectedBlock
    ? branches.filter((b) => b.block_id === selectedBlock.id)
    : []
  const selectedEdge = (() => {
    const sel = state.selection
    if (sel.kind !== 'edge') return null
    return edges.find((e) => e.id === sel.edgeId) ?? null
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
            onDropBlockType={onDropBlockType}
            dragApi={dragApi}
          />
          <BuilderDock
            catalogue={catalogue}
            onAddBlock={onAddBlock}
            onDragStartType={(bt) => dragApi.startNewDrag(bt.type, bt.allowed_lane_kind_codes)}
            onDragEndType={dragApi.endDrag}
          />
          {selectedBlock && (
            <BuilderDrawer
              block={selectedBlock}
              blockType={selectedBlockType}
              lane={selectedBlockLane}
              blocks={blocks}
              branches={selectedBlockBranches}
              currentPathwayId={pathway.id}
              onPatchConfig={(config) =>
                dispatch({ type: 'patch-block', blockId: selectedBlock.id, patch: { config } })
              }
              onRename={(label) =>
                dispatch({
                  type: 'patch-block',
                  blockId: selectedBlock.id,
                  patch: { label: label || null },
                })
              }
              onClose={() => dispatch({ type: 'select', selection: { kind: 'none' } })}
              onDelete={() => dispatch({ type: 'delete-block', blockId: selectedBlock.id })}
            />
          )}
          {selectedEdge && (
            <EdgeInspector
              edge={selectedEdge}
              timingKinds={timingKinds}
              offsetDirections={offsetDirections}
              timingValues={timingValues}
              timeMarkers={timeMarkers}
              blocks={blocks}
              branches={branches}
              onPatchEdge={(patch) =>
                dispatch({ type: 'patch-edge', edgeId: selectedEdge.id, patch })
              }
              onDelete={() => dispatch({ type: 'delete-edge', edgeId: selectedEdge.id })}
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
