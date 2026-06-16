import type { BlockSemantics } from '../types'

// Pathway-completion §A1 / §A2 / §A8 + §C4: per-kind authoring
// affordances. Adding a kind = one switch case.
export type BlockEditingFeatures = {
  hasName: boolean
  allowsLogic: boolean
  allowsTiming: boolean
  allowsParticipant: boolean
  deletable: boolean
}

// Materializing kinds carry a FHIR action.participant (role + specialty),
// resolved to a Practitioner at enrollment.
const MATERIALIZING_SEMANTICS = [
  'appointment',
  'treatment',
  'mdo',
  'task',
] as const satisfies readonly BlockSemantics[]

export function getBlockEditingFeatures(semantics: BlockSemantics): BlockEditingFeatures {
  const isStart = semantics === 'start'
  const isEnd = semantics === 'end_pathway'
  return {
    hasName: !isEnd,
    allowsLogic: !isStart,
    allowsTiming: !isStart && !isEnd && semantics !== 'informed_consent',
    allowsParticipant: (MATERIALIZING_SEMANTICS as readonly BlockSemantics[]).includes(semantics),
    deletable: !isStart && !isEnd,
  }
}
