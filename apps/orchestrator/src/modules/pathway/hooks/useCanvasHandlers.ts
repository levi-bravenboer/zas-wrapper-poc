import { useReactFlow, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { BLOCK_HEIGHT, BLOCK_WIDTH, type CanvasGeometry } from '../canvasLayout'
import type { CanvasDropTarget } from '../components/canvas/BuilderCanvasFrame'
import type { DragContextApi } from '../components/canvas/useDragContext'
import { DRAG_TYPES } from '../constants/dragTypes'
import {
  legacyBlockType,
  type DerivedEdge,
  type PathwayBlock,
  type PathwayBlockType,
  type PathwayLane,
} from '../types'
import type { BuilderAction } from '../useBuilderState'
import { isLaneAllowed } from '../utils/laneRules'

type Options = {
  blocks: PathwayBlock[]
  blockTypes: PathwayBlockType[]
  lanes: PathwayLane[]
  geometry: CanvasGeometry
  dispatch: (action: BuilderAction) => void
  onDropBlockType: (typeCode: string, target: CanvasDropTarget | null) => void
  dragApi: DragContextApi
}

type CanvasHandlers = {
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onPaneClick: () => void
}

export function useCanvasHandlers({
  blocks,
  blockTypes,
  lanes,
  geometry,
  dispatch,
  onDropBlockType,
  dragApi,
}: Options): CanvasHandlers {
  const { t } = useTranslation('pathway')
  const { screenToFlowPosition } = useReactFlow()

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position && !c.dragging) {
          const block = blocks.find((b) => b.id === c.id)
          if (!block) continue
          const targetLaneId = geometry.laneAt(c.position.y) ?? block.lane_id
          const targetLane = lanes.find((l) => l.id === targetLaneId)
          const bt = blockTypes.find((bt) => bt.type === legacyBlockType(block))
          if (bt && targetLane && !isLaneAllowed(bt, targetLane.lane_kind_code)) {
            toast.error(t('canvas.invalidLaneDrop'))
            continue
          }
          const baseX = geometry.phaseX(block.phase_id)
          const baseY = geometry.laneY(block.lane_id)
          dispatch({
            type: 'move-block',
            blockId: c.id,
            x: Math.round(c.position.x - baseX),
            y: Math.round(c.position.y - baseY),
          })
        }
        if (c.type === 'select' && c.selected) {
          dispatch({ type: 'select', selection: { kind: 'block', blockId: c.id } })
        }
        if (c.type === 'remove') dispatch({ type: 'delete-block', blockId: c.id })
      }
    },
    [blocks, blockTypes, lanes, geometry, dispatch, t],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) {
        if (c.type === 'select' && c.selected) {
          dispatch({ type: 'select', selection: { kind: 'edge', edgeId: c.id } })
        }
        if (c.type === 'remove') dispatch({ type: 'delete-edge', edgeId: c.id })
      }
    },
    [dispatch],
  )

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return
      // Chain slot #2 §3: drag-to-connect dispatches the new
      // `add-input-logic-rule` action — appends an `if_done` rule on
      // the target block's `input_logic`. The reducer + rule
      // inspector land alongside the input-logic-aware tests in §7.
      // Until then the connection is a no-op; the rule must be
      // authored in the (forthcoming) input-logic inspector.
      const edge: DerivedEdge = {
        source_block_id: c.source,
        target_block_id: c.target,
        predicate: 'if_done',
        args: { after_block: c.source },
      }
      dispatch({ type: 'add-edge', edge })
    },
    [dispatch],
  )

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const code = event.dataTransfer.getData(DRAG_TYPES.BLOCK_TYPE)
      if (!code) return
      const bt = blockTypes.find((b) => b.type === code)
      const flowPt = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const phaseId = geometry.phaseAt(flowPt.x)
      const laneId = geometry.laneAt(flowPt.y)
      if (!phaseId || !laneId) {
        dragApi.endDrag()
        onDropBlockType(code, null)
        return
      }
      const targetLane = lanes.find((l) => l.id === laneId)
      if (bt && targetLane && !isLaneAllowed(bt, targetLane.lane_kind_code)) {
        toast.error(t('canvas.invalidLaneDrop'))
        dragApi.endDrag()
        return
      }
      onDropBlockType(code, {
        phaseId,
        laneId,
        x: flowPt.x - geometry.phaseX(phaseId) - BLOCK_WIDTH / 2,
        y: flowPt.y - geometry.laneY(laneId) - BLOCK_HEIGHT / 2,
      })
      dragApi.endDrag()
    },
    [blockTypes, lanes, screenToFlowPosition, geometry, onDropBlockType, dragApi, t],
  )

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onPaneClick = useCallback(() => {
    dispatch({ type: 'select', selection: { kind: 'none' } })
  }, [dispatch])

  return { onNodesChange, onEdgesChange, onConnect, onDrop, onDragOver, onPaneClick }
}
