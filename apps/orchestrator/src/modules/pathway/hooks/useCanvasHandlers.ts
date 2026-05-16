import { useReactFlow, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react'
import { useCallback } from 'react'

import { BLOCK_HEIGHT, BLOCK_WIDTH, type CanvasGeometry } from '../canvasLayout'
import type { CanvasDropTarget } from '../components/canvas/BuilderCanvasFrame'
import { DRAG_TYPES } from '../constants/dragTypes'
import type { PathwayBlock, PathwayEdge } from '../types'
import type { BuilderAction } from '../useBuilderState'

type Options = {
  blocks: PathwayBlock[]
  geometry: CanvasGeometry
  dispatch: (action: BuilderAction) => void
  onDropBlockType: (typeCode: string, target: CanvasDropTarget | null) => void
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
  geometry,
  dispatch,
  onDropBlockType,
}: Options): CanvasHandlers {
  const { screenToFlowPosition } = useReactFlow()

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position && !c.dragging) {
          const block = blocks.find((b) => b.id === c.id)
          if (!block) continue
          const baseX = geometry.phaseX(block.phase_id)
          const baseY = geometry.laneY(block.lane_id)
          dispatch({
            type: 'move-block',
            blockId: c.id,
            x: c.position.x - baseX,
            y: c.position.y - baseY,
          })
        }
        if (c.type === 'select' && c.selected) {
          dispatch({ type: 'select', selection: { kind: 'block', blockId: c.id } })
        }
        if (c.type === 'remove') dispatch({ type: 'delete-block', blockId: c.id })
      }
    },
    [blocks, geometry, dispatch],
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
      const edge: PathwayEdge = {
        id: crypto.randomUUID(),
        source_block_id: c.source,
        target_block_id: c.target,
        source_branch_id: null,
        delay_value_id: null,
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
      const flowPt = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const phaseId = geometry.phaseAt(flowPt.x)
      const laneId = geometry.laneAt(flowPt.y)
      if (!phaseId || !laneId) {
        onDropBlockType(code, null)
        return
      }
      onDropBlockType(code, {
        phaseId,
        laneId,
        x: flowPt.x - geometry.phaseX(phaseId) - BLOCK_WIDTH / 2,
        y: flowPt.y - geometry.laneY(laneId) - BLOCK_HEIGHT / 2,
      })
    },
    [screenToFlowPosition, geometry, onDropBlockType],
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
