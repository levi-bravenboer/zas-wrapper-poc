import { X } from 'lucide-react'
import { useContext, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style/cn'

import { BulkBarContext } from './bulk-bar-context'

export interface BulkBarProps {
  className?: string
  children?: ReactNode
}

/**
 * Sticky bottom slide-up bar shown when there is an active selection. Receives
 * `count`/`onCancel` from the surrounding `DataTable` via context so the slot
 * is plug-and-play: `<DataTable.BulkBar>...consumer actions...</DataTable.BulkBar>`.
 */
export function BulkBar({ className, children }: BulkBarProps): ReactElement | null {
  const { t } = useTranslation('data-table')
  const ctx = useContext(BulkBarContext)
  if (!ctx) return null
  const { count, onCancel, visible } = ctx
  return (
    <div
      role="region"
      aria-live="polite"
      data-slot="data-table-bulk-bar"
      data-visible={visible ? 'true' : 'false'}
      className={cn(
        'sticky bottom-0 z-20 mt-2 flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 shadow-md',
        'transition-all duration-200 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        className,
      )}
    >
      <span className="text-sm font-medium">
        {t(count === 1 ? 'bulk.count.one' : 'bulk.count.other', { count })}
      </span>
      <div className="ml-auto flex items-center gap-2">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        aria-label={t('bulk.cancel')}
      >
        <X aria-hidden="true" className="size-4" />
        <span>{t('bulk.cancel')}</span>
      </Button>
    </div>
  )
}
