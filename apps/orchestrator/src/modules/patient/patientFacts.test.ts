import { describe, expect, it } from 'vitest'

import { ageFromBirthDate, pickInsz } from './patientFacts'
import type { PatientIdentifierRow } from './types'

const id = (p: Partial<PatientIdentifierRow>): PatientIdentifierRow =>
  ({ use: null, system: null, value: '', ...p }) as PatientIdentifierRow

describe('pickInsz', () => {
  it('returns null when there are no identifiers', () => {
    expect(pickInsz([])).toBeNull()
  })

  it('prefers the identifier flagged use=official', () => {
    expect(
      pickInsz([id({ use: 'usual', value: 'x' }), id({ use: 'official', value: '90010100156' })]),
    ).toBe('90010100156')
  })

  it.each(['urn:ssin', 'INSZ', 'urn:oid:2.16.56.1'])('matches the %s system', (system) => {
    expect(pickInsz([id({ system, value: '42' })])).toBe('42')
  })

  it('is case-insensitive on the system', () => {
    expect(pickInsz([id({ system: 'URN:SSIN', value: '7' })])).toBe('7')
  })

  it('returns null when nothing matches', () => {
    expect(pickInsz([id({ system: 'http://hospital/mrn', value: '1' })])).toBeNull()
  })
})

describe('ageFromBirthDate', () => {
  it('returns null for null/undefined/empty', () => {
    expect(ageFromBirthDate(null)).toBeNull()
    expect(ageFromBirthDate(undefined)).toBeNull()
    expect(ageFromBirthDate('')).toBeNull()
  })

  it('counts whole years for a birthday that already passed this year', () => {
    const birth = new Date(new Date().getFullYear() - 30, 0, 1) // Jan 1, 30y ago
    // Jan 1 has already passed (or is today) for any date in the year.
    expect(ageFromBirthDate(birth.toISOString())).toBe(30)
  })

  it('subtracts a year when the birthday has not occurred yet this year', () => {
    const now = new Date()
    const birth = new Date(now.getFullYear() - 30, 11, 31) // Dec 31, 30y ago
    const expected = now.getMonth() === 11 && now.getDate() === 31 ? 30 : 29
    expect(ageFromBirthDate(birth.toISOString())).toBe(expected)
  })
})
