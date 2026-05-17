import { Workflow } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { blockSemanticsSummary, resolveLucideIcon } from './blockCatalogue.utils'
import type { BlockSemantics } from './types'

describe('resolveLucideIcon', () => {
  it.each([
    'calendar',
    'clipboard-list',
    'clock',
    'flag',
    'git-branch',
    'hourglass',
    'link-2',
    'list-checks',
    'mail',
    'workflow',
  ])('resolves catalogue icon %s to a lucide component', (name) => {
    const Icon = resolveLucideIcon(name)
    expect(typeof Icon).toBe('object')
  })

  it('falls back to Workflow for unknown names', () => {
    expect(resolveLucideIcon('not-a-real-icon')).toBe(Workflow)
  })

  it('falls back to Workflow when name is undefined', () => {
    expect(resolveLucideIcon(undefined)).toBe(Workflow)
  })
})

describe('blockSemanticsSummary', () => {
  const cases: Array<[BlockSemantics, Record<string, unknown>, string | undefined]> = [
    ['appointment', { kind: 'consult' }, 'consult'],
    ['task', { assignee: 'caregiver' }, 'caregiver'],
    ['message', { channel: 'email' }, 'email'],
    ['form', { questions: [{ id: 'q1' }, { id: 'q2' }] }, '2'],
    ['decision', { criterion: 'risk_score' }, 'risk_score'],
    ['milestone', { note: 'baseline' }, 'baseline'],
    ['wait', { event_type: 'pathology_report' }, 'pathology_report'],
    ['pathway_link', { mode: 'blocking' }, 'blocking'],
  ]

  it.each(cases)('summarises %s from config', (semantics, config, expected) => {
    expect(blockSemanticsSummary(semantics, config)).toBe(expected)
  })

  it('returns undefined when semantics is undefined', () => {
    expect(blockSemanticsSummary(undefined, { kind: 'x' })).toBeUndefined()
  })

  it('returns undefined when config field is missing', () => {
    expect(blockSemanticsSummary('appointment', {})).toBeUndefined()
  })
})
