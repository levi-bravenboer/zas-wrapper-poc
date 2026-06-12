import type { EdgeChange, NodeChange } from '@xyflow/react'
import { useCallback } from 'react'

import type { BuilderAction } from '../useBuilderState'

type Options = {
  dispatch: (action: BuilderAction) => void
}

type CanvasHandlers = {
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onPaneClick: () => void
}

// Pathway-completion § C2.2: the canvas is read-only. Block positions
// come from the auto-layout pass (`computeBlockLayout`), edges derive
// from `input_logic` server-side. The only canvas interactions left are
// selection (open dialog / inspector) and keyboard remove.
export function useCanvasHandlers({ dispatch }: Options): CanvasHandlers {
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'select' && c.selected) {
          dispatch({ type: 'select', selection: { kind: 'block', blockId: c.id } })
        }
        if (c.type === 'remove') dispatch({ type: 'delete-block', blockId: c.id })
      }
    },
    [dispatch],
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

  const onPaneClick = useCallback(() => {
    dispatch({ type: 'select', selection: { kind: 'none' } })
  }, [dispatch])

  return { onNodesChange, onEdgesChange, onPaneClick }
}
