import { useTranslation } from 'react-i18next'

import { type SupportedLocale } from './index'

export function useLocale(): {
  locale: SupportedLocale
  changeLocale: (next: SupportedLocale) => Promise<void>
} {
  const { i18n } = useTranslation()
  const locale = (i18n.language as SupportedLocale) ?? 'nl'
  const changeLocale = async (next: SupportedLocale): Promise<void> => {
    await i18n.changeLanguage(next)
  }
  return { locale, changeLocale }
}
