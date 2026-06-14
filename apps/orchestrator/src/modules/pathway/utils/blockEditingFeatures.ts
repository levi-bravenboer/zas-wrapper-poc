import type { BlockSemantics } from '../types'

// Pathway-completion §A1 / §A2 / §A8 + §C4: per-kind rules for which
// sections the block dialog renders + which affordances the canvas
// shows. Centralised here so adding a new lifecycle kind only touches
// one file — every callsite reads the same source of truth.
//
// - `hasName`     — show the `Naam` input. `end_pathway` is anonymous
//                   (the circle shape conveys it).
// - `allowsLogic` — show the `input_logic` rule composer. `start`
//                   fires at enrollment t=0 so it has no upstream
//                   gates.
// - `allowsTiming`— show the `timing_policy` editor. `start` and
//                   `end_pathway` fire on lifecycle moments;
//                   `informed_consent` owns its timing via reminder /
//                   expiry per-kind fields.
// - `deletable`   — show the `Verwijderen` button + hover-X. `start`
//                   has cardinality exactly 1; `end_pathway` has
//                   cardinality ≥ 1 but locking it keeps the publish
//                   gate happy without UI gymnastics.
export type BlockEditingFeatures = {
  hasName: boolean
  allowsLogic: boolean
  allowsTiming: boolean
  deletable: boolean
}

export function getBlockEditingFeatures(semantics: BlockSemantics): BlockEditingFeatures {
  const isStart = semantics === 'start'
  const isEnd = semantics === 'end_pathway'
  return {
    hasName: !isEnd,
    allowsLogic: !isStart,
    allowsTiming: !isStart && !isEnd && semantics !== 'informed_consent',
    deletable: !isStart && !isEnd,
  }
}
