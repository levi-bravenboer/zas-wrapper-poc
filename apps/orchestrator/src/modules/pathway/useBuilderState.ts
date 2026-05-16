import { useEffect, useReducer, useRef, type Dispatch } from 'react'

import type {
  PathwayBlock,
  PathwayEdge,
  PathwayLane,
  PathwayPhase,
  PathwayVersionDefinition,
} from './types'

export type BuilderSelection =
  | { kind: 'none' }
  | { kind: 'block'; blockId: string }
  | { kind: 'edge'; edgeId: string }

type EditableSnapshot = {
  blocks: PathwayBlock[]
  edges: PathwayEdge[]
  phases: PathwayPhase[]
  lanes: PathwayLane[]
}

export type BuilderState = {
  version: PathwayVersionDefinition
  baseline: PathwayVersionDefinition
  selection: BuilderSelection
  history: { past: EditableSnapshot[]; future: EditableSnapshot[] }
}

export type BuilderAction =
  | { type: 'select'; selection: BuilderSelection }
  | { type: 'move-block'; blockId: string; x: number; y: number }
  | { type: 'patch-block'; blockId: string; patch: Partial<PathwayBlock> }
  | { type: 'add-block'; block: PathwayBlock }
  | { type: 'delete-block'; blockId: string }
  | { type: 'add-edge'; edge: PathwayEdge }
  | { type: 'delete-edge'; edgeId: string }
  | { type: 'add-phase'; phase: PathwayPhase }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; version: PathwayVersionDefinition }
  | { type: 'mark-saved' }

const HISTORY_LIMIT = 50

function snapshot(v: PathwayVersionDefinition): EditableSnapshot {
  return {
    blocks: (v.blocks ?? []).map((b) => ({ ...b })),
    edges: (v.edges ?? []).map((e) => ({ ...e })),
    phases: (v.phases ?? []).map((p) => ({ ...p })),
    lanes: (v.lanes ?? []).map((l) => ({ ...l })),
  }
}

function pushHistory(state: BuilderState): BuilderState['history'] {
  const past = [...state.history.past, snapshot(state.version)]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] }
}

function applySnapshot(
  base: PathwayVersionDefinition,
  snap: EditableSnapshot,
): PathwayVersionDefinition {
  return { ...base, blocks: snap.blocks, edges: snap.edges, phases: snap.phases, lanes: snap.lanes }
}

function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'select':
      return { ...state, selection: action.selection }
    case 'move-block': {
      const history = pushHistory(state)
      const blocks = (state.version.blocks ?? []).map((b) =>
        b.id === action.blockId ? { ...b, x: action.x, y: action.y } : b,
      )
      return { ...state, version: { ...state.version, blocks }, history }
    }
    case 'patch-block': {
      const history = pushHistory(state)
      const blocks = (state.version.blocks ?? []).map((b) =>
        b.id === action.blockId ? { ...b, ...action.patch } : b,
      )
      return { ...state, version: { ...state.version, blocks }, history }
    }
    case 'add-block': {
      const history = pushHistory(state)
      const blocks = [...(state.version.blocks ?? []), action.block]
      return {
        ...state,
        version: { ...state.version, blocks },
        history,
        selection: { kind: 'block', blockId: action.block.id },
      }
    }
    case 'delete-block': {
      const history = pushHistory(state)
      const blocks = (state.version.blocks ?? []).filter((b) => b.id !== action.blockId)
      const edges = (state.version.edges ?? []).filter(
        (e) => e.source_block_id !== action.blockId && e.target_block_id !== action.blockId,
      )
      return {
        ...state,
        version: { ...state.version, blocks, edges },
        history,
        selection: { kind: 'none' },
      }
    }
    case 'add-edge': {
      const history = pushHistory(state)
      const edges = [...(state.version.edges ?? []), action.edge]
      return { ...state, version: { ...state.version, edges }, history }
    }
    case 'delete-edge': {
      const history = pushHistory(state)
      const edges = (state.version.edges ?? []).filter((e) => e.id !== action.edgeId)
      return {
        ...state,
        version: { ...state.version, edges },
        history,
        selection: { kind: 'none' },
      }
    }
    case 'add-phase': {
      const history = pushHistory(state)
      const phases = [...(state.version.phases ?? []), action.phase].sort((a, b) => a.ord - b.ord)
      return { ...state, version: { ...state.version, phases }, history }
    }
    case 'undo': {
      if (state.history.past.length === 0) return state
      const past = [...state.history.past]
      const snap = past.pop()
      if (!snap) return state
      const future = [snapshot(state.version), ...state.history.future]
      return { ...state, version: applySnapshot(state.version, snap), history: { past, future } }
    }
    case 'redo': {
      if (state.history.future.length === 0) return state
      const [snap, ...future] = state.history.future
      if (!snap) return state
      const past = [...state.history.past, snapshot(state.version)]
      return { ...state, version: applySnapshot(state.version, snap), history: { past, future } }
    }
    case 'reset':
      return {
        version: action.version,
        baseline: action.version,
        selection: { kind: 'none' },
        history: { past: [], future: [] },
      }
    case 'mark-saved':
      return { ...state, baseline: state.version, history: { past: [], future: [] } }
  }
}

function init(version: PathwayVersionDefinition): BuilderState {
  return {
    version,
    baseline: version,
    selection: { kind: 'none' },
    history: { past: [], future: [] },
  }
}

export function useBuilderState(initial: PathwayVersionDefinition): {
  state: BuilderState
  dispatch: Dispatch<BuilderAction>
  isDirty: boolean
} {
  const [state, dispatch] = useReducer(reducer, initial, init)
  const seenRef = useRef(initial.id)
  useEffect(() => {
    if (seenRef.current !== initial.id) {
      seenRef.current = initial.id
      dispatch({ type: 'reset', version: initial })
    }
  }, [initial])
  const isDirty = state.version !== state.baseline
  return { state, dispatch, isDirty }
}
