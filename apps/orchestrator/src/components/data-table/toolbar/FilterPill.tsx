import { ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ListFilter } from '@/hooks/use-data-table-state'
import { cn } from '@/lib/style/cn'

import { pillActive, pillEmpty, pillX } from '../styles'
import { findOp, summariseFilter } from './chips'
import { DateRangeEditor, TextEditor, TypeaheadEditor } from './editors'
import type { DataTableFilter } from './Toolbar'

export interface FilterPillProps<T> {
  def: DataTableFilter<T>
  value: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

export function FilterPill<T>({ def, value, onChange }: FilterPillProps<T>) {
  const { t } = useTranslation('data-table')
  const summary = summariseFilter(def, value)
  const active = summary !== null

  const triggerLabel = (
    <span className="inline-flex items-center gap-1.5">
      <span>
        {def.label}
        {active ? ':' : ''}
      </span>
      {active ? (
        <span className="max-w-[16ch] truncate">{summary.display}</span>
      ) : (
        <ChevronDown aria-hidden className="size-3.5 opacity-60" />
      )}
    </span>
  )

  const clearButton = active ? (
    <button
      type="button"
      aria-label={t('toolbar.filters.pill.clearAria', { label: def.label })}
      className={pillX}
      onClick={() => onChange(def.key, null)}
    >
      <X className="h-3 w-3" />
    </button>
  ) : null

  const wrapperClass = cn('inline-flex items-center', active ? pillActive : pillEmpty)

  // List-style filters use shadcn DropdownMenu.
  if (def.type === 'select') {
    const selected = findOp(value, 'eq')
    const selectedValue = selected ? String(selected.value) : ''
    return (
      <div className={wrapperClass}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">{triggerLabel}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[14rem]">
            <DropdownMenuRadioGroup
              value={selectedValue}
              onValueChange={(v) => {
                if (!v) {
                  onChange(def.key, null)
                  return
                }
                onChange(def.key, { op: 'eq', value: v })
              }}
            >
              {def.options.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {selectedValue ? (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => onChange(def.key, null)}
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-foreground-muted outline-none hover:bg-surface-2 hover:text-foreground focus:bg-surface-2"
                >
                  {t('toolbar.filters.clear')}
                </button>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {clearButton}
      </div>
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
      if (next.size === 0) {
        onChange(def.key, null)
        return
      }
      onChange(def.key, { op: 'in', value: Array.from(next) })
    }
    return (
      <div className={wrapperClass}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">{triggerLabel}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[14rem]">
            {def.options.map((opt) => {
              const checked = selectedSet.has(opt.value)
              return (
                <DropdownMenuCheckboxItem
                  key={opt.value}
                  checked={checked}
                  onCheckedChange={(next) => toggle(opt.value, Boolean(next))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {opt.label}
                </DropdownMenuCheckboxItem>
              )
            })}
            {selectedSet.size > 0 ? (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => onChange(def.key, null)}
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-foreground-muted outline-none hover:bg-surface-2 hover:text-foreground focus:bg-surface-2"
                >
                  {t('toolbar.filters.clear')}
                </button>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {clearButton}
      </div>
    )
  }

  if (def.type === 'boolean') {
    const eq = findOp(value, 'eq')
    const choice = eq === undefined ? '' : eq.value === true || eq.value === 'true' ? 'true' : 'false'
    const trueLabel = def.trueLabel ?? t('toolbar.filters.boolean.true')
    const falseLabel = def.falseLabel ?? t('toolbar.filters.boolean.false')
    return (
      <div className={wrapperClass}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">{triggerLabel}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuRadioGroup
              value={choice}
              onValueChange={(v) => {
                if (!v) {
                  onChange(def.key, null)
                  return
                }
                onChange(def.key, { op: 'eq', value: v === 'true' })
              }}
            >
              <DropdownMenuRadioItem value="true">{trueLabel}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="false">{falseLabel}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            {choice ? (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => onChange(def.key, null)}
                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-foreground-muted outline-none hover:bg-surface-2 hover:text-foreground focus:bg-surface-2"
                >
                  {t('toolbar.filters.boolean.all')}
                </button>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {clearButton}
      </div>
    )
  }

  // Form-style filters use Popover with editor component.
  return <PopoverEditorPill def={def} value={value} onChange={onChange} />
}

function PopoverEditorPill<T>({ def, value, onChange }: FilterPillProps<T>) {
  const { t } = useTranslation('data-table')
  const [open, setOpen] = useState(false)
  const summary = summariseFilter(def, value)
  const active = summary !== null

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
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('inline-flex items-center', active ? pillActive : pillEmpty)}>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1.5">
            <span>
              {def.label}
              {active ? ':' : ''}
            </span>
            {active ? (
              <span className="max-w-[16ch] truncate">{summary.display}</span>
            ) : (
              <ChevronDown aria-hidden className="size-3.5 opacity-60" />
            )}
          </button>
        </PopoverTrigger>
        {active ? (
          <button
            type="button"
            aria-label={t('toolbar.filters.pill.clearAria', { label: def.label })}
            className={pillX}
            onClick={() => onChange(def.key, null)}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      <PopoverContent align="start" className={contentClass}>
        {editor}
      </PopoverContent>
    </Popover>
  )
}
