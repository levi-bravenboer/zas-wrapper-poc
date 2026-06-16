import type { BlockSemantics } from '../types'

// Pathway-completion §A1 / §A2 / §A8 + §C4: per-kind authoring
// affordances. Adding a kind = one switch case.
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
