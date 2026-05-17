import { useEffect, useReducer, useRef, type Dispatch } from 'react'

import { sortByOrd } from '@/lib/utils/ordinal'

import { HISTORY_LIMIT } from './constants/limits'
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

export type DimensionMap = ReadonlyMap<string, number>

export type BuilderState = {
  version: PathwayVersionDefinition
  baseline: PathwayVersionDefinition
  selection: BuilderSelection
  history: { past: EditableSnapshot[]; future: EditableSnapshot[] }
  phaseSizes: DimensionMap
  laneSizes: DimensionMap
}

export type BuilderAction =
  | { type: 'select'; selection: BuilderSelection }
  | { type: 'move-block'; blockId: string; x: number; y: number }
  | { type: 'patch-block'; blockId: string; patch: Partial<PathwayBlock> }
  | { type: 'add-block'; block: PathwayBlock }
  | { type: 'delete-block'; blockId: string }
  | { type: 'add-edge'; edge: PathwayEdge }
  | { type: 'patch-edge'; edgeId: string; patch: Partial<PathwayEdge> }
  | { type: 'delete-edge'; edgeId: string }
  | { type: 'add-phase'; phase: PathwayPhase }
  | { type: 'reorder-phase'; phaseId: string; toIndex: number }
  | { type: 'resize-phase'; phaseId: string; width: number }
  | { type: 'resize-lane'; laneId: string; height: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; version: PathwayVersionDefinition }
  | { type: 'mark-saved' }

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
    case 'patch-edge': {
      const history = pushHistory(state)
      const edges = (state.version.edges ?? []).map((e) =>
        e.id === action.edgeId ? { ...e, ...action.patch } : e,
      )
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
      const phases = sortByOrd([...(state.version.phases ?? []), action.phase])
      return { ...state, version: { ...state.version, phases }, history }
    }
    case 'resize-phase':
      return {
        ...state,
        phaseSizes: new Map(state.phaseSizes).set(action.phaseId, action.width),
      }
    case 'resize-lane':
      return {
        ...state,
        laneSizes: new Map(state.laneSizes).set(action.laneId, action.height),
      }
    case 'reorder-phase': {
      const current = sortByOrd(state.version.phases ?? [])
      const fromIndex = current.findIndex((p) => p.id === action.phaseId)
      if (fromIndex < 0) return state
      const toIndex = Math.max(0, Math.min(current.length - 1, action.toIndex))
      if (fromIndex === toIndex) return state
      const history = pushHistory(state)
      const moved = current[fromIndex]
      if (!moved) return state
      const next = [...current]
      next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      const phases = next.map((p, i) => ({ ...p, ord: (i + 1) * 10 }))
      return { ...state, version: { ...state.version, phases }, history }
    }
    case 'undo': {
      const past = [...state.history.past]
      const snap = past.pop()
      if (!snap) return state
      const future = [snapshot(state.version), ...state.history.future]
      return { ...state, version: applySnapshot(state.version, snap), history: { past, future } }
    }
    case 'redo': {
      const [snap, ...future] = state.history.future
      if (!snap) return state
      const past = [...state.history.past, snapshot(state.version)]
      return { ...state, version: applySnapshot(state.version, snap), history: { past, future } }
    }
    case 'reset': {
      const ensured = ensureLanes(action.version)
      return {
        version: ensured,
        baseline: ensured,
        selection: { kind: 'none' },
        history: { past: [], future: [] },
        phaseSizes: new Map(),
        laneSizes: new Map(),
      }
    }
    case 'mark-saved':
      return { ...state, baseline: state.version, history: { past: [], future: [] } }
  }
}

const DEFAULT_LANE_SCAFFOLD: Array<{
  code: PathwayLane['lane_kind_code']
  label: string
  is_default: boolean
}> = [
  { code: 'patient', label: 'Patiënt', is_default: true },
  { code: 'caregiver', label: 'Zorgteam', is_default: false },
  { code: 'system', label: 'Systeem', is_default: false },
]

function ensureLanes(version: PathwayVersionDefinition): PathwayVersionDefinition {
  if (version.lanes?.length) return version
  const lanes: PathwayLane[] = DEFAULT_LANE_SCAFFOLD.map((entry, i) => ({
    id: crypto.randomUUID(),
    pathway_lane_kind_id: crypto.randomUUID(),
    lane_kind_code: entry.code,
    label: entry.label,
    ord: (i + 1) * 10,
    is_default: entry.is_default,
  }))
  return { ...version, lanes }
}

function init(version: PathwayVersionDefinition): BuilderState {
  const ensured = ensureLanes(version)
  return {
    version: ensured,
    baseline: ensured,
    selection: { kind: 'none' },
    history: { past: [], future: [] },
    phaseSizes: new Map(),
    laneSizes: new Map(),
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
