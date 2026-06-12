import { PanelLeftOpen } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style/cn'

export type MasterDetailLayoutProps = {
  master: ReactNode
  detail: ReactNode | null
  masterCollapsed: boolean
  onMasterCollapsedChange: (collapsed: boolean) => void
}

/**
 * 3-state master/detail layout per design.md D15.
 *
 * State 1 (no detail): master at full width, detail column absent.
 * State 2 (detail set + master open): master compresses to 320px rail,
 *   detail renders alongside it.
 * State 3 (detail set + master collapsed): master width 0, detail fills
 *   width, floating reopen button at top-left brings master back.
 *
 * Below the `md` breakpoint (per D17), the detail column is suppressed in
 * the layout itself — the route file is expected to redirect mobile clicks
 * to a standalone full-page detail route. This layout still renders master
 * full-width below `md` so the rail-vs-full responsive split stays here.
 */
export function MasterDetailLayout({
  master,
  detail,
  masterCollapsed,
  onMasterCollapsedChange,
}: MasterDetailLayoutProps): ReactElement {
  const { t } = useTranslation('common')
  const hasDetail = detail !== null
  const inSplitMode = hasDetail

  return (
    <div className="relative flex h-full min-h-0 w-full">
      <div
        data-slot="master"
        data-state={
          !inSplitMode ? 'full' : masterCollapsed ? 'hidden' : 'compact'
        }
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden transition-[width] duration-250 ease-out',
          // mobile: full-width regardless of split mode (detail column skipped)
          'w-full md:w-auto',
          inSplitMode
            ? masterCollapsed
              ? 'md:w-0 md:border-r-0'
              : 'md:w-[320px] md:border-r md:border-border'
            : 'md:w-full',
        )}
      >
        {master}
      </div>

      {hasDetail && (
        <div
          data-slot="detail"
          // mobile: hide entirely (route swap handles full-page detail)
          className="hidden h-full min-h-0 flex-1 overflow-hidden md:flex md:flex-col"
        >
          {detail}
        </div>
      )}

      {inSplitMode && masterCollapsed && (
        <Button
          data-slot="master-reopen"
          variant="outline"
          size="icon"
          aria-label={t('masterDetail.openMaster')}
          onClick={() => onMasterCollapsedChange(false)}
          className="absolute left-3 top-3 z-10 hidden md:inline-flex"
        >
          <PanelLeftOpen className="size-4" />
        </Button>
      )}
    </div>
  )
}
