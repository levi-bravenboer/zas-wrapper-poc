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

import { PATHWAY_LINK_MODES } from '../../../../../configSchemas'

// Author-time `mode` enum on the Luscii block config. Identical to the
// existing pathway-link link-mode constant — re-exported here so Luscii
// callsites don't reach across into pathway-link internals.
export const LUSCII_PROGRAM_MODES = PATHWAY_LINK_MODES
export type LusciiProgramMode = (typeof LUSCII_PROGRAM_MODES)[number]

// Canonical identifiers for this provider + its single kind. Keep these
// constants in one place so the router, dimensions dispatcher, palette
// grouping, and any future site stay aligned on the dotted code form.
export const LUSCII_PROVIDER = 'luscii' as const
export const LUSCII_PROGRAM_KIND = 'program' as const
export const LUSCII_PROGRAM_BLOCK_TYPE = `${LUSCII_PROVIDER}.${LUSCII_PROGRAM_KIND}` as const

export type LusciiProvider = typeof LUSCII_PROVIDER
export type LusciiProgramKind = typeof LUSCII_PROGRAM_KIND
export type LusciiProgramBlockType = typeof LUSCII_PROGRAM_BLOCK_TYPE
