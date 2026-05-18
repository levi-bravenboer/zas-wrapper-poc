import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/style/cn'

import { tableFooter } from './styles'

export interface DataTablePaginationProps {
  page: number
  pageSize: number
  totalPages: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  className?: string
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50]

export function DataTablePagination({
  page,
  pageSize,
  totalPages,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  className,
}: DataTablePaginationProps) {
  const { t } = useTranslation('data-table')
  const pageSizeLabelId = useId()

  const safeTotalPages = Math.max(totalPages, 1)
  const isFirstPage = page <= 1
  const isLastPage = page >= safeTotalPages

  const handlePageSizeChange = (value: string) => {
    const next = Number(value)
    if (!Number.isFinite(next) || next <= 0) return
    onPageSizeChange(next)
    onPageChange(1)
  }

  return (
    <div
      className={cn(tableFooter, 'flex-col gap-3 sm:flex-row', className)}
    >
      <div className="flex items-center gap-2">
        <span id={pageSizeLabelId} className="text-sm text-foreground-muted">
          {t('pagination.pageSize')}
        </span>
        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
          <SelectTrigger aria-labelledby={pageSizeLabelId} className="h-9 w-auto min-w-[5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled={isFirstPage}
          disabled={isFirstPage}
          onClick={() => {
            if (isFirstPage) return
            onPageChange(page - 1)
          }}
        >
          {t('pagination.previous')}
        </Button>
        <span aria-live="polite" className="min-w-[4rem] text-center text-sm tabular-nums">
          {t('pagination.indicator', { page, total: safeTotalPages })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled={isLastPage}
          disabled={isLastPage}
          onClick={() => {
            if (isLastPage) return
            onPageChange(page + 1)
          }}
        >
          {t('pagination.next')}
        </Button>
      </div>
    </div>
  )
}
