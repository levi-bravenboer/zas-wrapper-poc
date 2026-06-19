import { describe, expect, it } from 'vitest'

import { getBlockEditingFeatures } from './blockEditingFeatures'

describe('getBlockEditingFeatures', () => {
  it('start: no logic, no timing, no delete, has name', () => {
    expect(getBlockEditingFeatures('start')).toEqual({
      hasName: true,
      allowsLogic: false,
      allowsTiming: false,
      allowsParticipant: false,
      deletable: false,
    })
  })

  it('end_pathway: no name, no timing, no delete, logic allowed', () => {
    expect(getBlockEditingFeatures('end_pathway')).toEqual({
      hasName: false,
      allowsLogic: true,
      allowsTiming: false,
      allowsParticipant: false,
      deletable: false,
    })
  })

  it('informed_consent: timing forbidden (per-kind reminder fields own it), rest editable', () => {
    expect(getBlockEditingFeatures('informed_consent')).toEqual({
      hasName: true,
      allowsLogic: true,
      allowsTiming: false,
      allowsParticipant: false,
      deletable: true,
    })
  })

  it('regular kinds (appointment, task, decision, …) opt into every section', () => {
    for (const semantics of ['appointment', 'task', 'decision'] as const) {
      const features = getBlockEditingFeatures(semantics)
      expect(features.hasName).toBe(true)
      expect(features.allowsLogic).toBe(true)
      expect(features.allowsTiming).toBe(true)
      expect(features.deletable).toBe(true)
    }
  })

  it('participant section: only materializing kinds (appointment, treatment, mdo, task)', () => {
    for (const semantics of ['appointment', 'treatment', 'mdo', 'task'] as const) {
      expect(getBlockEditingFeatures(semantics).allowsParticipant).toBe(true)
    }
    for (const semantics of ['decision', 'start', 'end_pathway', 'informed_consent'] as const) {
      expect(getBlockEditingFeatures(semantics).allowsParticipant).toBe(false)
    }
  })
})
