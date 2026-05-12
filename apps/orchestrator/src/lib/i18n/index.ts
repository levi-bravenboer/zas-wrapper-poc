import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import auth from './locales/nl/auth.json'
import common from './locales/nl/common.json'

export type SupportedLocale = 'nl' | 'fr' | 'en'

export const DEFAULT_LOCALE: SupportedLocale = 'nl'

void i18next.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: ['common', 'auth'],
  resources: {
    nl: { common, auth },
  },
  interpolation: { escapeValue: false },
  returnNull: false,
})

export const i18n = i18next
