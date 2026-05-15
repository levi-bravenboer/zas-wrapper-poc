import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import auth from './locales/nl/auth.json'
import common from './locales/nl/common.json'
import nav from './locales/nl/nav.json'
import shell from './locales/nl/shell.json'
import smart from './locales/nl/smart.json'
import states from './locales/nl/states.json'

export const SUPPORTED_LOCALES = ['nl', 'fr', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'nl'

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

void i18next.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: ['common', 'auth', 'nav', 'shell', 'smart', 'states'],
  resources: {
    nl: { common, auth, nav, shell, smart, states },
  },
  interpolation: { escapeValue: false },
  returnNull: false,
})

export const i18n = i18next
