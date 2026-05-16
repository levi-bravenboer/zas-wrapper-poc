import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { LANE_ROW_HEIGHT, laneRowY, phaseColumnX } from '../canvasLayout'
import { useReplacePathway } from '../hooks'
import type {
  PathwayBare,
  PathwayBlock,
  PathwayBlockType,
  PathwayPhase,
  PathwayPhaseTemplate,
  PathwayVersionDefinition,
} from '../types'
import { useBuilderState } from '../useBuilderState'
import { useCollapsedSidebar } from '../useCollapsedSidebar'

import { BuilderCanvasFrame } from './canvas/BuilderCanvasFrame'
import { BuilderDock } from './dock/BuilderDock'
import { BuilderDrawer } from './drawer/BuilderDrawer'
import { MinimapZoomPanel } from './minimap/MinimapZoomPanel'
import { BuilderSubbar } from './subbar/BuilderSubbar'
import { BuilderTopbar } from './topbar/BuilderTopbar'
import type { SaveState } from './topbar/SaveStatusPill'

type Props = {
  pathway: PathwayBare
  version: PathwayVersionDefinition
  catalogue: PathwayBlockType[]
  phaseTemplates: PathwayPhaseTemplate[]
}

export function PathwayBuilderShell({
  pathway,
  version,
  catalogue,
  phaseTemplates,
}: Props): ReactElement {
  useCollapsedSidebar()
  return (
    <ReactFlowProvider>
      <Inner
        pathway={pathway}
        version={version}
        catalogue={catalogue}
        phaseTemplates={phaseTemplates}
      />
    </ReactFlowProvider>
  )
}

function Inner({ pathway, version, catalogue, phaseTemplates }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const { state, dispatch, isDirty } = useBuilderState(version)
  const replace = useReplacePathway(pathway.id)

  const saveState: SaveState = replace.isPending
    ? 'saving'
    : replace.isError
      ? 'error'
      : isDirty
        ? 'dirty'
        : 'clean'

  const onSave = useCallback(() => {
    const v = state.version
    replace.mutate(
      {
        name: pathway.name,
        clinical_goal: pathway.clinical_goal ?? null,
        patient_goal: pathway.patient_goal ?? null,
        phases: v.phases ?? [],
        lanes: (v.lanes ?? []).map((l) => ({
          id: l.id,
          lane_kind_code: l.lane_kind_code,
          label: l.label,
          ord: l.ord,
          is_default: l.is_default,
        })),
        timing_values: (v.timing_values ?? []).map((tv) => ({ ...tv })),
        blocks: (v.blocks ?? []).map((b) => ({
          id: b.id,
          phase_id: b.phase_id,
          lane_id: b.lane_id,
          type: b.type,
          label: b.label ?? null,
          duration_value_id: b.duration_value_id ?? null,
          config: b.config ?? {},
          x: b.x,
          y: b.y,
        })),
        branches: (v.branches ?? []).map((br) => ({ ...br })),
        edges: (v.edges ?? []).map((e) => ({ ...e })),
        time_markers: (v.time_markers ?? []).map((tm) => ({ ...tm })),
        deferred_fields: (v.deferred_fields ?? []).map((df) => ({ ...df })),
      },
      {
        onSuccess: (next) => {
          dispatch({ type: 'reset', version: next.version })
          toast.success(t('save.success'))
        },
        onError: () => {
          toast.error(t('save.error'))
        },
      },
    )
  }, [state.version, pathway, replace, dispatch, t])

  const onRename = useCallback(
    (name: string) => {
      replace.mutate(
        {
          name,
          clinical_goal: pathway.clinical_goal ?? null,
          patient_goal: pathway.patient_goal ?? null,
        },
        {
          onError: () => toast.error(t('save.error')),
        },
      )
    },
    [pathway, replace, t],
  )

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        if (isDirty && saveState !== 'saving') onSave()
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault()
        dispatch({ type: 'redo' })
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        dispatch({ type: 'undo' })
      } else if (event.key === 'Escape') {
        dispatch({ type: 'select', selection: { kind: 'none' } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, saveState, onSave, dispatch])

  const phases = useMemo(() => state.version.phases ?? [], [state.version.phases])
  const lanes = useMemo(() => state.version.lanes ?? [], [state.version.lanes])
  const blocks = useMemo(() => state.version.blocks ?? [], [state.version.blocks])
  const edges = useMemo(() => state.version.edges ?? [], [state.version.edges])
  const timingValues = useMemo(
    () => state.version.timing_values ?? [],
    [state.version.timing_values],
  )

  const onAddBlock = useCallback(
    (blockType: PathwayBlockType) => {
      const defaultLane =
        lanes.find((l) => l.lane_kind_code === blockType.default_lane_kind_code) ?? lanes[0]
      const firstPhase = [...phases].sort((a, b) => a.ord - b.ord)[0]
      if (!defaultLane || !firstPhase) return
      const block: PathwayBlock = {
        id: crypto.randomUUID(),
        phase_id: firstPhase.id,
        lane_id: defaultLane.id,
        type: blockType.type,
        label: null,
        duration_value_id: null,
        config: {},
        x: 70,
        y: LANE_ROW_HEIGHT / 2 - 32,
      }
      dispatch({ type: 'add-block', block })
    },
    [lanes, phases, dispatch],
  )

  const onDropBlockType = useCallback(
    (typeCode: string, _position: { x: number; y: number }) => {
      const bt = catalogue.find((c) => c.type === typeCode)
      if (bt) onAddBlock(bt)
    },
    [catalogue, onAddBlock],
  )

  const onJumpToPhase = useCallback((_phaseId: string) => {
    // PoC: rely on default fit; viewport jumping deferred.
  }, [])

  const onAddPhase = useCallback(
    (template: PathwayPhaseTemplate | null) => {
      const nextOrd = (phases.reduce((m, p) => Math.max(m, p.ord), 0) || 0) + 10
      const phase: PathwayPhase = {
        id: crypto.randomUUID(),
        template_id: template?.id ?? null,
        label: template?.label ?? t('subbar.customPhase'),
        ord: nextOrd,
      }
      dispatch({ type: 'add-phase', phase })
    },
    [phases, dispatch, t],
  )

  const selectedBlockId = state.selection.kind === 'block' ? state.selection.blockId : null
  const selectedBlock = selectedBlockId
    ? (blocks.find((b) => b.id === selectedBlockId) ?? null)
    : null
  const selectedBlockType = selectedBlock
    ? (catalogue.find((c) => c.type === selectedBlock.type) ?? null)
    : null
  const selectedBlockLane = selectedBlock
    ? (lanes.find((l) => l.id === selectedBlock.lane_id) ?? null)
    : null

  // Reserve sentinel for canvas size to drive scrollable region — keeps lane labels
  // visible even after horizontal pan thanks to xyflow's viewport.
  const _canvasW = phaseColumnX(phases.length)
  const _canvasH = laneRowY(lanes.length)
  void _canvasW
  void _canvasH

  return (
    <div
      data-slot="pathway-builder-shell"
      className="grid h-[100dvh] min-h-0 grid-rows-[var(--builder-row-topbar)_var(--builder-row-subbar)_1fr]"
    >
      <BuilderTopbar
        pathway={pathway}
        blockCount={blocks.length}
        phaseCount={phases.length}
        saveState={saveState}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onSave={onSave}
        onRename={onRename}
      />
      <BuilderSubbar
        phases={phases}
        templates={phaseTemplates}
        onJumpToPhase={onJumpToPhase}
        onAddPhase={onAddPhase}
      />
      <main role="main" className="relative min-h-0 overflow-hidden">
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
        />
        <BuilderDock catalogue={catalogue} onAddBlock={onAddBlock} />
        <MinimapZoomPanel />
        {selectedBlock && (
          <BuilderDrawer
            block={selectedBlock}
            blockType={selectedBlockType}
            lane={selectedBlockLane}
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
      </main>
    </div>
  )
}
