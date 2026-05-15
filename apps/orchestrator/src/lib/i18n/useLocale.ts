import { useTranslation } from 'react-i18next'

import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from './index'

export function useLocale(): {
  locale: SupportedLocale
  changeLocale: (next: SupportedLocale) => Promise<void>
} {
  const { i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const changeLocale = async (next: SupportedLocale): Promise<void> => {
    await i18n.changeLanguage(next)
  }
  return { locale, changeLocale }
}
