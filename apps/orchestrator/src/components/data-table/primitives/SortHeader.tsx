import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { HeaderCell } from './Table'

export interface SortHeaderProps {
  sortKey: string
  iconState: 'asc' | 'desc' | null
  ariaSort: 'ascending' | 'descending' | 'none'
  onCycle: (sortKey: string) => void
  children: ReactNode
  className?: string
}

export function SortHeader({
  sortKey,
  iconState,
  ariaSort,
  onCycle,
  children,
  className,
}: SortHeaderProps) {
  const { t } = useTranslation('data-table')
  const stateLabel =
    iconState === null
      ? t('sort.ariaNone')
      : iconState === 'asc'
        ? t('sort.ariaAscending')
        : t('sort.ariaDescending')
  return (
    <HeaderCell aria-sort={ariaSort} className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onCycle(sortKey)}
      >
        <span className="sr-only">{stateLabel}</span>
        {children}
        {iconState === 'asc' ? (
          <ChevronUp aria-hidden className="size-3" />
        ) : iconState === 'desc' ? (
          <ChevronDown aria-hidden className="size-3" />
        ) : (
          <ChevronsUpDown aria-hidden className="size-3 opacity-50" />
        )}
      </button>
    </HeaderCell>
  )
}
