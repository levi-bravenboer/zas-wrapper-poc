import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import auth from './locales/nl/auth.json'
import common from './locales/nl/common.json'
import nav from './locales/nl/nav.json'
import smart from './locales/nl/smart.json'

export type SupportedLocale = 'nl' | 'fr' | 'en'

export const DEFAULT_LOCALE: SupportedLocale = 'nl'

void i18next.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: ['common', 'auth', 'nav', 'smart'],
  resources: {
    nl: { common, auth, nav, smart },
  },
  interpolation: { escapeValue: false },
  returnNull: false,
})

export const i18n = i18next
