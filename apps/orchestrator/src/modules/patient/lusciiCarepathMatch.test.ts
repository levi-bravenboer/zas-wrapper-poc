import { describe, expect, it } from 'vitest'

import { bucketConnections, matchCarepath, type EnrollmentCarepath } from './lusciiCarepathMatch'

const enrollments: EnrollmentCarepath[] = [
  { enrollmentId: 'e-active', pathwayName: 'Hartfalen', state: 'active', programIds: ['p-1'] },
  { enrollmentId: 'e-done', pathwayName: 'Oud pad', state: 'completed', programIds: ['p-2'] },
]

const conn = (id: string, status: 'active' | 'inactive', programId: string | null) => ({
  connection_id: id,
  status,
  program: programId ? { id: programId } : null,
})

describe('matchCarepath', () => {
  it('matches a program id to its enrollment', () => {
    expect(matchCarepath('p-1', enrollments)?.enrollmentId).toBe('e-active')
    expect(matchCarepath('p-2', enrollments)?.state).toBe('completed')
  })

  it('returns null for no program id or no match', () => {
    expect(matchCarepath(null, enrollments)).toBeNull()
    expect(matchCarepath('p-x', enrollments)).toBeNull()
  })

  it('prefers an active/paused enrollment on a tie', () => {
    const tie: EnrollmentCarepath[] = [
      { enrollmentId: 'old', pathwayName: 'A', state: 'cancelled', programIds: ['p-1'] },
      { enrollmentId: 'new', pathwayName: 'B', state: 'active', programIds: ['p-1'] },
    ]
    expect(matchCarepath('p-1', tie)?.enrollmentId).toBe('new')
  })
})

describe('bucketConnections', () => {
  it('routes active connections to current / history / unassigned', () => {
    const result = bucketConnections(
      [
        conn('c-current', 'active', 'p-1'),
        conn('c-history', 'active', 'p-2'),
        conn('c-unassigned', 'active', 'p-x'),
        conn('c-inactive', 'inactive', 'p-1'),
      ],
      enrollments,
    )
    expect(result.current.map((b) => b.connection.connection_id)).toEqual(['c-current'])
    expect(result.history.map((b) => b.connection.connection_id)).toEqual([
      'c-history',
      'c-inactive',
    ])
    expect(result.unassigned.map((b) => b.connection.connection_id)).toEqual(['c-unassigned'])
  })

  it('attaches the matched carepath ref to current connections', () => {
    const result = bucketConnections([conn('c', 'active', 'p-1')], enrollments)
    expect(result.current[0]?.carepath).toEqual({
      enrollmentId: 'e-active',
      pathwayName: 'Hartfalen',
      state: 'active',
    })
  })
})
