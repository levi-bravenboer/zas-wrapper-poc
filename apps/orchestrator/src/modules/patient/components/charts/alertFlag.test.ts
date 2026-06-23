import { describe, expect, it } from 'vitest'

import { alertColor, alertSeverity } from './alertFlag'

describe('alertSeverity', () => {
  it('maps "red" to critical', () => {
    expect(alertSeverity('red')).toBe('critical')
    expect(alertSeverity('RED')).toBe('critical')
    expect(alertSeverity('  red ')).toBe('critical')
  })

  it('maps any other non-empty flag to warning', () => {
    expect(alertSeverity('orange')).toBe('warning')
    expect(alertSeverity('amber')).toBe('warning')
    expect(alertSeverity('whatever')).toBe('warning')
  })

  it('returns null for no alert', () => {
    expect(alertSeverity(null)).toBeNull()
    expect(alertSeverity(undefined)).toBeNull()
    expect(alertSeverity('')).toBeNull()
    expect(alertSeverity('   ')).toBeNull()
  })
})

describe('alertColor', () => {
  it('returns the destructive token for critical and warning token otherwise', () => {
    expect(alertColor('red')).toBe('var(--color-destructive)')
    expect(alertColor('orange')).toBe('var(--color-warning)')
  })

  it('returns null when there is no alert', () => {
    expect(alertColor(null)).toBeNull()
    expect(alertColor('')).toBeNull()
  })
})
