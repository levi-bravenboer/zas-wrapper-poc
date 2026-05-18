import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

import { clearAllBtn } from '../styles'

export interface ClearAllProps {
  onClick: () => void
  className?: string
}

export function ClearAll({ onClick, className }: ClearAllProps) {
  const { t } = useTranslation('data-table')
  return (
    <button type="button" onClick={onClick} className={cn(clearAllBtn, className)}>
      {t('toolbar.filters.clear')}
    </button>
  )
}
