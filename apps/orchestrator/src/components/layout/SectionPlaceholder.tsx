import { useTranslation } from 'react-i18next'

type Props = {
  titleKey: `nav.${string}`
}

export function SectionPlaceholder({ titleKey }: Props) {
  const { t } = useTranslation('nav')
  const titleSuffix = titleKey.replace(/^nav\./, '')
  return (
    <section className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">{t(titleSuffix)}</h1>
      <p className="mt-2 text-muted-foreground">{t('placeholder')}</p>
    </section>
  )
}
