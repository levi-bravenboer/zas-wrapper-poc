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

export type BuilderSelection = { kind: 'none' } | { kind: 'block'; blockId: string }

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

const READ_ONLY_PASSTHROUGH: ReadonlySet<BuilderAction['type']> = new Set([
  'select',
  'reset',
  'mark-saved',
])

function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  if (state.version.status !== 'concept' && !READ_ONLY_PASSTHROUGH.has(action.type)) {
    return state
  }
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
      // Cast: `Partial<PathwayBlock>` is a partial of the typed
      // discriminated union, so spreading it over a narrowed member
      // produces an unknown intersection. Inspectors only patch shared
      // envelope fields (`label`, `config`, position) plus per-kind
      // typed fields that are valid for the active block's kind; the
      // result remains within the union by construction.
      const blocks = ((state.version.blocks ?? []) as PathwayBlock[]).map((b) =>
        b.id === action.blockId ? ({ ...b, ...action.patch } as PathwayBlock) : b,
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
      return {
        ...state,
        version: cascadeDeleteBlock(state.version, action.blockId),
        history,
        selection: { kind: 'none' },
      }
    }
    case 'add-phase': {
      const history = pushHistory(state)
      const phases = sortByOrd([...(state.version.phases ?? []), action.phase])
      return { ...state, version: { ...state.version, phases }, history }
    }
    case 'resize-phase': {
      const history = pushHistory(state)
      const phases = (state.version.phases ?? []).map((p) =>
        p.id === action.phaseId ? { ...p, width_px: action.width } : p,
      )
      return { ...state, version: { ...state.version, phases }, history }
    }
    case 'resize-lane': {
      const history = pushHistory(state)
      const lanes = (state.version.lanes ?? []).map((l) =>
        l.id === action.laneId ? { ...l, height_px: action.height } : l,
      )
      return { ...state, version: { ...state.version, lanes }, history }
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
      // Preserve the active selection when its target survives the incoming
      // version. Autosave dispatches `reset` on every successful PUT; without
      // this guard the inspector slams shut mid-edit and the user loses focus.
      const preserved = preserveSelection(state.selection, ensured)
      return {
        version: ensured,
        baseline: ensured,
        selection: preserved,
        history: { past: [], future: [] },
      }
    }
    case 'mark-saved':
      return { ...state, baseline: state.version, history: { past: [], future: [] } }
  }
}

/** Blocks whose `input_logic.rules` reference `blockId` — shown in the
 * delete-confirm dialog and stripped by the cascade
 * (pathway-completion § C5). */
export function dependentBlocks(blocks: PathwayBlock[], blockId: string): PathwayBlock[] {
  return blocks.filter(
    (b) => b.id !== blockId && (b.input_logic?.rules ?? []).some((r) => r.node === blockId),
  )
}

/** Cascade-delete (pathway-completion § C5.1): drop the block, strip
 * every other block's `input_logic.rules` entries that reference it,
 * drop its branches, and drop derived edges touching it. Concept
 * version template only — published versions are immutable and active
 * runtime enrollments are never mutated by builder edits. */
export function cascadeDeleteBlock(
  version: PathwayVersionDefinition,
  blockId: string,
): PathwayVersionDefinition {
  const blocks = ((version.blocks ?? []) as PathwayBlock[])
    .filter((b) => b.id !== blockId)
    .map((b) => {
      const rules = b.input_logic?.rules ?? []
      const kept = rules.filter((r) => r.node !== blockId)
      if (kept.length === rules.length) return b
      return {
        ...b,
        input_logic: { ...(b.input_logic ?? { aggregator: 'all_of' }), rules: kept },
      } as PathwayBlock
    })
  const edges = (version.edges ?? []).filter(
    (e) => e.source_block_id !== blockId && e.target_block_id !== blockId,
  )
  const branches = (version.branches ?? []).filter((br) => br.block_id !== blockId)
  return { ...version, blocks, edges, branches }
}

const DEFAULT_LANE_SCAFFOLD: Array<{
  code: PathwayLane['lane_kind_code']
  label: string
  is_default: boolean
}> = [
  { code: 'patient', label: 'Patiënt', is_default: true },
  { code: 'caregiver', label: 'Zorgteam', is_default: false },
  { code: 'system', label: 'Systeem', is_default: false },
  { code: 'external', label: 'Extern', is_default: false },
]

/** Ensure every kind in `DEFAULT_LANE_SCAFFOLD` has a corresponding lane row.
 * Pre-existing lanes are preserved; only the missing kinds are appended at the
 * tail. Lets pathways authored before a kind was introduced (e.g. `external`)
 * become drop-targets for that kind's blocks without a manual backfill. */
function ensureLanes(version: PathwayVersionDefinition): PathwayVersionDefinition {
  const existing = version.lanes ?? []
  const presentCodes = new Set(existing.map((l) => l.lane_kind_code))
  const missing = DEFAULT_LANE_SCAFFOLD.filter((entry) => !presentCodes.has(entry.code))
  if (missing.length === 0)
    return existing === version.lanes ? version : { ...version, lanes: existing }
  const maxOrd = existing.reduce((acc, l) => Math.max(acc, l.ord), 0)
  const appended: PathwayLane[] = missing.map((entry, i) => ({
    id: crypto.randomUUID(),
    pathway_lane_kind_id: crypto.randomUUID(),
    lane_kind_code: entry.code,
    label: entry.label,
    ord: maxOrd + (i + 1) * 10,
    is_default: existing.length === 0 && entry.is_default,
    height_px: 180,
  }))
  return { ...version, lanes: [...existing, ...appended] }
}

/** Keep an active selection alive across a `reset` when its target still
 * exists in the incoming version. Drops to `{ kind: 'none' }` otherwise so
 * the inspector closes when the underlying block / edge disappears. */
function preserveSelection(
  current: BuilderSelection,
  next: PathwayVersionDefinition,
): BuilderSelection {
  if (current.kind === 'block') {
    return (next.blocks ?? []).some((b) => b.id === current.blockId) ? current : { kind: 'none' }
  }
  return current
}

function init(version: PathwayVersionDefinition): BuilderState {
  const ensured = ensureLanes(version)
  return {
    version: ensured,
    baseline: ensured,
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
