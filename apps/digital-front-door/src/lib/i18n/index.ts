import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import nlBeCommon from './locales/nl-BE/common.json'

export const LOCALE_NL_BE = 'nl-BE' as const

export const i18n = createInstance()

let initPromise: Promise<void> | undefined

export async function initI18n(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = i18n
    .use(initReactI18next)
    .init({
      resources: {
        'nl-BE': { common: nlBeCommon },
      },
      lng: LOCALE_NL_BE,
      fallbackLng: LOCALE_NL_BE,
      defaultNS: 'common',
      ns: ['common'],
      interpolation: { escapeValue: false },
      returnNull: false,
    })
    .then(() => undefined)

  return initPromise
}
