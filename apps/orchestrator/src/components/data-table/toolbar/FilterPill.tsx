import { Check, ChevronDown, X } from 'lucide-react'
import { useState, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import type { ListFilter } from '@/hooks/use-data-table-state'
import { cn } from '@/lib/style/cn'

import { findOp, summariseFilter } from './chips'
import { DateRangeEditor, TextEditor, TypeaheadEditor } from './editors'
import type { DataTableFilter } from './Toolbar'

export interface FilterPillProps<T> {
  def: DataTableFilter<T>
  value: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

type FilterTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  summary: string | null
}

function FilterTrigger({ label, summary, className, ...rest }: FilterTriggerProps): ReactElement {
  const active = summary !== null
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-8 border-dashed font-normal',
        active && 'border-solid border-primary/40 bg-primary-subtle/40',
        className,
      )}
      {...rest}
    >
      <span>{label}</span>
      {active ? (
        <>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Badge variant="soft" className="rounded-sm px-1.5 py-0 font-normal">
            <span className="max-w-[14ch] truncate">{summary}</span>
          </Badge>
        </>
      ) : (
        <ChevronDown aria-hidden className="size-3.5 opacity-60" />
      )}
    </Button>
  )
}

interface FilterShellProps<T> extends FilterPillProps<T> {
  children: ReactNode
}

function FilterShell<T>({ def, value, onChange, children }: FilterShellProps<T>): ReactElement {
  const { t } = useTranslation('data-table')
  const summary = summariseFilter(def, value)
  return (
    <div className="inline-flex items-center gap-1">
      {children}
      {summary !== null ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('toolbar.filters.pill.clearAria', { label: def.label })}
          className="size-7"
          onClick={() => onChange(def.key, null)}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  )
}

export function FilterPill<T>({ def, value, onChange }: FilterPillProps<T>): ReactElement {
  const { t } = useTranslation('data-table')
  const summary = summariseFilter(def, value)
  const triggerLabel = <FilterTrigger label={def.label} summary={summary?.display ?? null} />

  if (def.type === 'select') {
    const selected = findOp(value, 'eq')
    const selectedValue = selected ? String(selected.value) : ''
    return (
      <FilterShell def={def} value={value} onChange={onChange}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{triggerLabel}</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[14rem]">
            <DropdownMenuRadioGroup
              value={selectedValue}
              onValueChange={(v) => {
                if (!v) onChange(def.key, null)
                else onChange(def.key, { op: 'eq', value: v })
              }}
            >
              {def.options.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </FilterShell>
    )
  }

  if (def.type === 'multi') {
    const active = findOp(value, 'in')
    const selectedSet = new Set<string>(
      active ? (Array.isArray(active.value) ? active.value : [active.value]).map(String) : [],
    )
    const toggle = (v: string, checked: boolean) => {
      const next = new Set(selectedSet)
      if (checked) next.add(v)
      else next.delete(v)
      if (next.size === 0) onChange(def.key, null)
      else onChange(def.key, { op: 'in', value: Array.from(next) })
    }
    return (
      <FilterShell def={def} value={value} onChange={onChange}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{triggerLabel}</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[14rem]">
            {def.options.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selectedSet.has(opt.value)}
                onCheckedChange={(next) => toggle(opt.value, Boolean(next))}
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </FilterShell>
    )
  }

  if (def.type === 'boolean') {
    const trueLabel = def.trueLabel ?? t('toolbar.filters.boolean.true')
    const falseLabel = def.falseLabel ?? t('toolbar.filters.boolean.false')
    const allLabel = t('toolbar.filters.boolean.all')
    const eq = findOp(value, 'eq')
    const choice =
      eq === undefined ? '' : eq.value === true || eq.value === 'true' ? 'true' : 'false'
    return (
      <FilterShell def={def} value={value} onChange={onChange}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{triggerLabel}</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuRadioGroup
              value={choice}
              onValueChange={(v) => {
                if (!v) onChange(def.key, null)
                else onChange(def.key, { op: 'eq', value: v === 'true' })
              }}
            >
              <DropdownMenuRadioItem value="true">
                <Check
                  aria-hidden
                  className={cn('mr-2 size-3.5', choice === 'true' ? 'opacity-100' : 'opacity-0')}
                />
                {trueLabel}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="false">
                <Check
                  aria-hidden
                  className={cn('mr-2 size-3.5', choice === 'false' ? 'opacity-100' : 'opacity-0')}
                />
                {falseLabel}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            {choice ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onChange(def.key, null)}>
                  {allLabel}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </FilterShell>
    )
  }

  return <PopoverEditorPill def={def} value={value} onChange={onChange} />
}

function PopoverEditorPill<T>({ def, value, onChange }: FilterPillProps<T>): ReactElement {
  const [open, setOpen] = useState(false)
  const summary = summariseFilter(def, value)
  const triggerLabel = <FilterTrigger label={def.label} summary={summary?.display ?? null} />

  const editor = (() => {
    switch (def.type) {
      case 'date-range':
        return <DateRangeEditor def={def} current={value} onChange={onChange} />
      case 'text':
        return <TextEditor def={def} current={value} onChange={onChange} />
      case 'typeahead':
        return <TypeaheadEditor def={def} current={value} onChange={onChange} />
      default:
        return null
    }
  })()
  const isTypeahead = def.type === 'typeahead'
  const contentClass = isTypeahead ? 'w-80 p-0' : 'w-72 p-2'

  return (
    <FilterShell def={def} value={value} onChange={onChange}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerLabel}</PopoverTrigger>
        <PopoverContent align="start" className={contentClass}>
          {editor}
        </PopoverContent>
      </Popover>
    </FilterShell>
  )
}
