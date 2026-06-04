import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/style/cn'

import { stickyFirst } from '../styles'

import { Cell } from './Table'

export interface ExpandToggleProps {
  expanded: boolean
  onToggle: () => void
  sticky?: boolean
}

export function ExpandToggle({ expanded, onToggle, sticky = false }: ExpandToggleProps) {
  const { t } = useTranslation('data-table')
  return (
    <Cell data-stop-row-click="" className={cn(sticky && stickyFirst)}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t('expand.toggle')}
        className="inline-flex size-6 items-center justify-center rounded text-foreground-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
            e.preventDefault()
            onToggle()
          }
        }}
      >
        {expanded ? (
          <ChevronDown aria-hidden className="size-4" />
        ) : (
          <ChevronRight aria-hidden className="size-4" />
        )}
      </button>
    </Cell>
  )
}
