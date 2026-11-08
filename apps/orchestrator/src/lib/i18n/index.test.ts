import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  i18n,
  isSupportedLocale,
} from './index'

const nlFiles = import.meta.glob<{ default: object }>('./locales/nl/*.json', { eager: true })
const enFiles = import.meta.glob<{ default: object }>('./locales/en/*.json', { eager: true })

function keyPaths(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keyPaths(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

describe('isSupportedLocale', () => {
  it.each(SUPPORTED_LOCALES)('accepts %s', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true)
  })

  it('rejects unknown locales', () => {
    expect(isSupportedLocale('de')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
    expect(isSupportedLocale('NL')).toBe(false)
  })

  it('uses nl as the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('nl')
  })
})

describe('locale files', () => {
  it('ships an en file for every nl namespace', () => {
    const names = (files: Record<string, unknown>) =>
      Object.keys(files)
        .map((path) => path.split('/').at(-1))
        .toSorted()
    expect(names(enFiles)).toEqual(names(nlFiles))
  })

  it.each(Object.keys(nlFiles))('en mirrors every key of %s', (nlPath) => {
    const enModule = enFiles[nlPath.replace('/nl/', '/en/')]
    const nlModule = nlFiles[nlPath]
    expect(enModule).toBeDefined()
    if (!enModule || !nlModule) return
    expect(keyPaths(enModule.default).toSorted()).toEqual(keyPaths(nlModule.default).toSorted())
  })
})

describe('locale persistence', () => {
  it('remembers the chosen language in localStorage', async () => {
    await i18n.changeLanguage('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    await i18n.changeLanguage(DEFAULT_LOCALE)
  })
})
