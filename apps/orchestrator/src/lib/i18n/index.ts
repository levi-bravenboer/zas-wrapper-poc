import i18next, { type Resource, type ResourceLanguage } from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LOCALES = ['nl', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'nl'

const INTL_LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const satisfies Record<SupportedLocale, string>
export const LOCALE_STORAGE_KEY = 'zas.locale'

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

const localeFiles = import.meta.glob<{ default: ResourceLanguage[string] }>('./locales/*/*.json', {
  eager: true,
})

const resources: Resource = {}
for (const [path, file] of Object.entries(localeFiles)) {
  const [, locale, namespace] = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path) ?? []
  if (!locale || !namespace) continue
  resources[locale] ??= {}
  resources[locale][namespace] = file.default
}

// localStorage throws SecurityError when storage is blocked (sandboxed HiX embed iframe)
function storedLocale(): SupportedLocale {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? ''
    return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

i18next.on('languageChanged', (locale) => {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // storage blocked: choice lasts for this session only
  }
  if (typeof document !== 'undefined') document.documentElement.lang = locale
})

void i18next.use(initReactI18next).init({
  lng: storedLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  defaultNS: 'common',
  ns: Object.keys(resources[DEFAULT_LOCALE] ?? {}),
  resources,
  interpolation: { escapeValue: false },
  returnNull: false,
})

export const i18n = i18next

export function intlLocale(locale: string = i18next.language): string {
  return isSupportedLocale(locale) ? INTL_LOCALES[locale] : locale
}
