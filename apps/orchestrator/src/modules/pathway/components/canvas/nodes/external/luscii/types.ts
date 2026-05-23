// Local re-exports of the generated Luscii schemas. Keeps Luscii-internal
// imports short (`import { LusciiProgramData } from './types'`) and lets us
// add a thin domain alias later without touching every consumer.

import type { components } from '@/lib/api/schema'

export type LusciiProgramData = components['schemas']['LusciiProgramData']
export type LusciiLayout = components['schemas']['LusciiLayout']
export type LusciiLayoutPhase = components['schemas']['LusciiLayoutPhase']
export type LusciiLayoutLane = components['schemas']['LusciiLayoutLane']
export type LusciiLayoutNode = components['schemas']['LusciiLayoutNode']
export type LusciiLayoutEdge = components['schemas']['LusciiLayoutEdge']
export type LusciiProtocol = components['schemas']['LusciiProtocol']
export type LusciiInstrument = components['schemas']['LusciiInstrument']
export type LusciiAlertThreshold = components['schemas']['LusciiAlertThreshold']

// Derived literal-union for the Luscii layout's lane kinds. Keeps consumers
// type-safe against the generated OpenAPI source of truth — never hand-list
// the kinds in a string literal.
export type LusciiLaneKind = LusciiLayoutLane['kind']

// Author-time `mode` enum on the Luscii block config. Mirrors the catalogue
// entry's JSON Schema enum + the existing `PATHWAY_LINK_MODES` constant.
export const LUSCII_PROGRAM_MODES = ['blocking', 'fire_and_forget'] as const
export type LusciiProgramMode = (typeof LUSCII_PROGRAM_MODES)[number]
