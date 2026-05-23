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
