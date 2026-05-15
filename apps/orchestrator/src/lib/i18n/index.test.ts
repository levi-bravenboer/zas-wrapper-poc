import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale } from './index'

describe('isSupportedLocale', () => {
  it.each(SUPPORTED_LOCALES)('accepts %s', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true)
  })

  it('rejects unknown locales', () => {
    expect(isSupportedLocale('de')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
    expect(isSupportedLocale('NL')).toBe(false)
  })

  it('narrows the type for supported values', () => {
    const value: string = 'fr'
    expect(isSupportedLocale(value)).toBe(true)
    const narrowed: 'nl' | 'fr' | 'en' = isSupportedLocale(value) ? value : 'nl'
    expect(narrowed).toBe('fr')
  })

  it('uses nl as the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('nl')
  })
})
