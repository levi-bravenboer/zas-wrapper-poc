import { useCallback, useMemo, useReducer } from 'react'

import type { OrganisationTreeMove } from '../schemas'

export type EditorMode = 'read' | 'edit'

export interface EditorState {
  mode: EditorMode
  // Map keyed by org id so multiple moves on the same node collapse to
  // the latest one — matches the backend's "1 move per id" invariant.
  pendingMoves: ReadonlyMap<string, OrganisationTreeMove>
  expanded: ReadonlySet<string>
}

type EditorAction =
  | { type: 'enterEdit' }
  | { type: 'exitEdit' }
  | { type: 'moveNode'; move: OrganisationTreeMove }
  | { type: 'toggleExpand'; id: string }
  | { type: 'reset' }
  | { type: 'setExpanded'; ids: Iterable<string> }

const EMPTY_MOVES: ReadonlyMap<string, OrganisationTreeMove> = new Map()
const EMPTY_EXPANDED: ReadonlySet<string> = new Set()

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'enterEdit':
      return { ...state, mode: 'edit' }
    case 'exitEdit':
      return { ...state, mode: 'read', pendingMoves: EMPTY_MOVES }
    case 'moveNode': {
      const next = new Map(state.pendingMoves)
      next.set(action.move.id, action.move)
      return { ...state, pendingMoves: next }
    }
    case 'toggleExpand': {
      const next = new Set(state.expanded)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, expanded: next }
    }
    case 'setExpanded':
      return { ...state, expanded: new Set(action.ids) }
    case 'reset':
      return { mode: 'read', pendingMoves: EMPTY_MOVES, expanded: state.expanded }
    default:
      return state
  }
}

function initialState(initialExpanded?: Iterable<string>): EditorState {
  return {
    mode: 'read',
    pendingMoves: EMPTY_MOVES,
    expanded: initialExpanded ? new Set(initialExpanded) : EMPTY_EXPANDED,
  }
}

export interface UseOrganisationTreeEditor {
  mode: EditorMode
  pendingMoves: ReadonlyMap<string, OrganisationTreeMove>
  expanded: ReadonlySet<string>
  enterEdit: () => void
  exitEdit: () => void
  moveNode: (move: OrganisationTreeMove) => void
  toggleExpand: (id: string) => void
  reset: () => void
  setExpanded: (ids: Iterable<string>) => void
}

export function useOrganisationTreeEditor(
  initialExpanded?: Iterable<string>,
): UseOrganisationTreeEditor {
  const [state, dispatch] = useReducer(reducer, initialExpanded, initialState)

  const enterEdit = useCallback(() => dispatch({ type: 'enterEdit' }), [])
  const exitEdit = useCallback(() => dispatch({ type: 'exitEdit' }), [])
  const moveNode = useCallback(
    (move: OrganisationTreeMove) => dispatch({ type: 'moveNode', move }),
    [],
  )
  const toggleExpand = useCallback(
    (id: string) => dispatch({ type: 'toggleExpand', id }),
    [],
  )
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])
  const setExpanded = useCallback(
    (ids: Iterable<string>) => dispatch({ type: 'setExpanded', ids }),
    [],
  )

  return useMemo(
    () => ({
      mode: state.mode,
      pendingMoves: state.pendingMoves,
      expanded: state.expanded,
      enterEdit,
      exitEdit,
      moveNode,
      toggleExpand,
      reset,
      setExpanded,
    }),
    [state, enterEdit, exitEdit, moveNode, toggleExpand, reset, setExpanded],
  )
}
