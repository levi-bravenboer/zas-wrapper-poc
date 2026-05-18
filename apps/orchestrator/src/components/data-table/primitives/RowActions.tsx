import { MoreHorizontal } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/style/cn'

import type { DataTableRowAction } from '../types'

export interface RowActionsProps {
  actions: DataTableRowAction[]
  ariaLabel: string
}

export function RowActions({ actions, ariaLabel }: RowActionsProps): ReactElement | null {
  const { t } = useTranslation('data-table')
  const [pending, setPending] = useState<DataTableRowAction | null>(null)
  if (actions.length === 0) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
            }}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((a, i) => (
            <DropdownMenuItem
              key={i}
              aria-disabled={a.disabled || undefined}
              data-disabled={a.disabled ? 'true' : undefined}
              onSelect={(e) => {
                if (a.disabled) {
                  e.preventDefault()
                  return
                }
                if (a.confirm) {
                  setPending(a)
                  return
                }
                a.onClick()
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(a.destructive && 'text-destructive focus:text-destructive')}
            >
              {a.icon}
              <span>{a.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          {pending?.confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{pending.confirm.title}</AlertDialogTitle>
                {pending.confirm.description ? (
                  <AlertDialogDescription>{pending.confirm.description}</AlertDialogDescription>
                ) : null}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {pending.confirm.cancelLabel ?? t('confirm.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  className={cn(
                    pending.destructive &&
                      'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40',
                  )}
                  onClick={() => {
                    const action = pending
                    setPending(null)
                    action.onClick()
                  }}
                >
                  {pending.confirm.confirmLabel ?? t('confirm.ok')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
