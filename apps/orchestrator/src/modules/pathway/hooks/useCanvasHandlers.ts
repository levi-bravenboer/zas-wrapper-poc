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

// Pathway-completion § C2.2: blocks may be re-aligned within their
// (phase, lane) cell — the drag stop handler lives in
// `BuilderCanvasFrame`. Selection routes to the dialog; keyboard
// remove cascades through `delete-block`. Edges are derived from
// `input_logic` server-side and are not selectable, deletable, or
// draggable.
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

  // Edges are derived from `input_logic` server-side. They are not
  // selectable, not deletable, not draggable — no-op handler so
  // xyflow has somewhere to call into without throwing.
  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {}, [])

  const onPaneClick = useCallback(() => {
    dispatch({ type: 'select', selection: { kind: 'none' } })
  }, [dispatch])

  return { onNodesChange, onEdgesChange, onPaneClick }
}
