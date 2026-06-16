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

// Selection routes to the dialog; keyboard remove cascades through
// `delete-block`. Edges are derived from `input_logic` and inert.
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

  // Edges are derived — no-op so xyflow has a handler to call.
  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {}, [])

  const onPaneClick = useCallback(() => {
    dispatch({ type: 'select', selection: { kind: 'none' } })
  }, [dispatch])

  return { onNodesChange, onEdgesChange, onPaneClick }
}
