import { describe, expect, it } from 'vitest'

import { getBlockEditingFeatures } from './blockEditingFeatures'

describe('getBlockEditingFeatures', () => {
  it('start: no logic, no timing, no delete, has name', () => {
    expect(getBlockEditingFeatures('start')).toEqual({
      hasName: true,
      allowsLogic: false,
      allowsTiming: false,
      deletable: false,
    })
  })

  it('end_pathway: no name, no timing, no delete, logic allowed', () => {
    expect(getBlockEditingFeatures('end_pathway')).toEqual({
      hasName: false,
      allowsLogic: true,
      allowsTiming: false,
      deletable: false,
    })
  })

  it('informed_consent: timing forbidden (per-kind reminder fields own it), rest editable', () => {
    expect(getBlockEditingFeatures('informed_consent')).toEqual({
      hasName: true,
      allowsLogic: true,
      allowsTiming: false,
      deletable: true,
    })
  })

  it('regular kinds (appointment, task, decision, …) opt into every section', () => {
    for (const semantics of ['appointment', 'task', 'decision'] as const) {
      expect(getBlockEditingFeatures(semantics)).toEqual({
        hasName: true,
        allowsLogic: true,
        allowsTiming: true,
        deletable: true,
      })
    }
  })
})
