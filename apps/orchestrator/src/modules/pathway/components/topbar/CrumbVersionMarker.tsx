import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { PathwayVersionDefinition } from '../../types'

type Props = {
  version: PathwayVersionDefinition
  isHistorical: boolean
}

function dotColor(status: 'concept' | 'published' | 'archived', isHistorical: boolean): string {
  if (isHistorical) return '#3a7d8d'
  if (status === 'concept') return '#d97706'
  if (status === 'published') return '#16a34a'
  return '#3a7d8d'
}

export function CrumbVersionMarker({ version, isHistorical }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const stateWord = isHistorical
    ? t('version.crumb.historical')
    : version.status === 'concept'
      ? t('version.crumb.concept')
      : t('version.crumb.published')

  return (
    <span
      aria-hidden="true"
      data-slot="crumb-version-marker"
      className="inline-flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ background: dotColor(version.status, isHistorical) }}
      />
      <span>{t('version.label', { n: version.version_no })}</span>
      <span>· {stateWord}</span>
    </span>
  )
}
