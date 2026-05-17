import { X } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ListFilter, ListFilterOperator } from '@/hooks/use-data-table-state'
import { cn } from '@/lib/style/cn'

/**
 * Public filter definition contract.
 *
 * Consumers describe their available filters; the toolbar renders an appropriate
 * control for each `type` and emits `ListFilter` (or `ListFilter[]`) values via
 * `onFilterChange`. The integrating `DataTable` is expected to swap this for
 * the canonical shared type once `types.ts` lands — until then the local
 * definition keeps this file self-contained.
 */
export type DataTableFilter<T> =
  | {
      type: 'select'
      key: keyof T & string
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | {
      type: 'multi'
      key: keyof T & string
      label: string
      options: ReadonlyArray<{ value: string; label: string }>
    }
  | { type: 'date-range'; key: keyof T & string; label: string }
  | { type: 'text'; key: keyof T & string; label: string }

export interface DataTableToolbarProps<T> {
  q: string | null
  filters: Record<string, ListFilter | ListFilter[]>
  filterDefs?: ReadonlyArray<DataTableFilter<T>>
  onSearchChange: (q: string | null) => void
  onFilterChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
  onClearFilters: () => void
  className?: string
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Slot marker components
// ---------------------------------------------------------------------------
//
// The compound API exposes `Toolbar.Search`, `Toolbar.Filters`, `Toolbar.Actions`.
// They render their children as-is when used outside `Toolbar`, but inside
// `Toolbar` we recognise their `displayName` to route them to fixed slots.

interface SlotChildrenProps {
  children?: React.ReactNode
  className?: string
}

function SearchSlot({ children, className }: SlotChildrenProps) {
  return <div className={cn('flex flex-1 min-w-0 items-center', className)}>{children}</div>
}
SearchSlot.displayName = 'DataTableToolbar.Search'

function FiltersSlot({ children, className }: SlotChildrenProps) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
FiltersSlot.displayName = 'DataTableToolbar.Filters'

function ActionsSlot({ children, className }: SlotChildrenProps) {
  return <div className={cn('flex items-center gap-2', className)}>{children}</div>
}
ActionsSlot.displayName = 'DataTableToolbar.Actions'

const SLOT_NAMES = new Set([
  'DataTableToolbar.Search',
  'DataTableToolbar.Filters',
  'DataTableToolbar.Actions',
])

function getSlotName(child: React.ReactNode): string | null {
  if (!React.isValidElement(child)) return null
  const t = child.type as { displayName?: string } | string | undefined
  if (typeof t === 'function' || typeof t === 'object') {
    const name = (t as { displayName?: string }).displayName
    if (name && SLOT_NAMES.has(name)) return name
  }
  return null
}

// ---------------------------------------------------------------------------
// Search (debounced 300ms)
// ---------------------------------------------------------------------------

interface InternalSearchProps {
  value: string | null
  onChange: (next: string | null) => void
  placeholder: string
}

function DebouncedSearch({ value, onChange, placeholder }: InternalSearchProps) {
  const [local, setLocal] = React.useState<string>(value ?? '')
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmittedRef = React.useRef<string | null>(value)

  // Sync from outside (e.g. clear-all, URL change) when our local copy is stale.
  React.useEffect(() => {
    const incoming = value ?? ''
    if (incoming !== local && (value ?? null) !== lastEmittedRef.current) {
      setLocal(incoming)
    }
    // We intentionally depend only on the external `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setLocal(next)
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const normalised = next.trim() ? next : null
      lastEmittedRef.current = normalised
      onChange(normalised)
    }, 300)
  }

  return (
    <Input
      type="search"
      value={local}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label={placeholder}
      className="max-w-xs"
    />
  )
}

// ---------------------------------------------------------------------------
// Filter helpers — convert `ListFilter`(s) <-> form values
// ---------------------------------------------------------------------------

function findOp(
  value: ListFilter | ListFilter[] | undefined,
  op: ListFilterOperator,
): ListFilter | undefined {
  if (!value) return undefined
  if (Array.isArray(value)) return value.find((f) => f.op === op)
  return value.op === op ? value : undefined
}

function primitiveToString(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ')
  return String(v)
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

interface ChipDescriptor {
  field: string
  label: string
  display: string
}

function buildChips<T>(
  defs: ReadonlyArray<DataTableFilter<T>>,
  filters: Record<string, ListFilter | ListFilter[]>,
): ChipDescriptor[] {
  return defs.flatMap<ChipDescriptor>((def) => {
    const value = filters[def.key]
    if (!value) return []
    switch (def.type) {
      case 'select': {
        const f = findOp(value, 'eq')
        if (!f) return []
        const opt = def.options.find((o) => o.value === String(f.value))
        return [
          {
            field: def.key,
            label: def.label,
            display: opt?.label ?? primitiveToString(f.value),
          },
        ]
      }
      case 'multi': {
        const f = findOp(value, 'in')
        if (!f) return []
        const values = Array.isArray(f.value) ? f.value : [f.value]
        const display = values
          .map((v) => def.options.find((o) => o.value === String(v))?.label ?? String(v))
          .join(', ')
        return [{ field: def.key, label: def.label, display }]
      }
      case 'date-range': {
        const gte = findOp(value, 'gte')
        const lte = findOp(value, 'lte')
        if (!gte && !lte) return []
        const from = gte ? primitiveToString(gte.value) : '…'
        const to = lte ? primitiveToString(lte.value) : '…'
        return [{ field: def.key, label: def.label, display: `${from} – ${to}` }]
      }
      case 'text': {
        const f = findOp(value, 'contains')
        if (!f) return []
        return [{ field: def.key, label: def.label, display: primitiveToString(f.value) }]
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Filter editor controls (rendered inside the filter dropdown)
// ---------------------------------------------------------------------------

interface FilterEditorProps<T> {
  def: DataTableFilter<T>
  current: ListFilter | ListFilter[] | undefined
  onChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
}

function SelectFilterEditor<T>({ def, current, onChange }: FilterEditorProps<T>) {
  if (def.type !== 'select') return null
  const active = findOp(current, 'eq')
  const value = active ? String(active.value) : ''
  return (
    <Select
      onValueChange={(v) => onChange(def.key, { op: 'eq', value: v })}
      {...(value && { value })}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder={def.label} />
      </SelectTrigger>
      <SelectContent>
        {def.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function MultiFilterEditor<T>({ def, current, onChange }: FilterEditorProps<T>) {
  if (def.type !== 'multi') return null
  const active = findOp(current, 'in')
  const selected = new Set<string>(
    active ? (Array.isArray(active.value) ? active.value : [active.value]).map(String) : [],
  )
  const toggle = (v: string) => {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    if (next.size === 0) {
      onChange(def.key, null)
      return
    }
    onChange(def.key, { op: 'in', value: Array.from(next) })
  }
  return (
    <div className="flex flex-col gap-1 p-1">
      {def.options.map((opt) => {
        const checked = selected.has(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left outline-none',
              'hover:bg-surface-2',
              checked && 'bg-surface-2 font-medium',
            )}
          >
            <span
              className={cn(
                'inline-flex h-4 w-4 items-center justify-center rounded-sm border border-input',
                checked && 'bg-primary text-primary-foreground',
              )}
              aria-hidden
            >
              {checked ? '✓' : ''}
            </span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function DateRangeFilterEditor<T>({ def, current, onChange }: FilterEditorProps<T>) {
  if (def.type !== 'date-range') return null
  const gte = findOp(current, 'gte')
  const lte = findOp(current, 'lte')
  const from = gte ? String(gte.value) : ''
  const to = lte ? String(lte.value) : ''

  const commit = (nextFrom: string, nextTo: string) => {
    const parts: ListFilter[] = []
    if (nextFrom) parts.push({ op: 'gte', value: nextFrom })
    if (nextTo) parts.push({ op: 'lte', value: nextTo })
    if (!parts.length) {
      onChange(def.key, null)
      return
    }
    onChange(def.key, parts.length === 1 ? parts[0]! : parts)
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <label className="flex flex-col gap-1 text-xs text-foreground-muted">
        {def.label} — van
        <Input
          type="date"
          value={from}
          onChange={(e) => commit(e.target.value, to)}
          className="h-9"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-foreground-muted">
        {def.label} — tot
        <Input
          type="date"
          value={to}
          onChange={(e) => commit(from, e.target.value)}
          className="h-9"
        />
      </label>
    </div>
  )
}

function TextFilterEditor<T>({ def, current, onChange }: FilterEditorProps<T>) {
  if (def.type !== 'text') return null
  const active = findOp(current, 'contains')
  const value = active ? String(active.value) : ''
  return (
    <div className="p-2">
      <Input
        type="text"
        value={value}
        placeholder={def.label}
        onChange={(e) => {
          const next = e.target.value
          if (!next.trim()) onChange(def.key, null)
          else onChange(def.key, { op: 'contains', value: next })
        }}
        className="h-9"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Built-in filter trigger (dropdown listing all filter definitions)
// ---------------------------------------------------------------------------

interface FilterDropdownProps<T> {
  defs: ReadonlyArray<DataTableFilter<T>>
  filters: Record<string, ListFilter | ListFilter[]>
  onFilterChange: (field: string, filter: ListFilter | ListFilter[] | null) => void
  triggerLabel: string
}

function FilterDropdown<T>({
  defs,
  filters,
  onFilterChange,
  triggerLabel,
}: FilterDropdownProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {defs.map((def, idx) => (
          <React.Fragment key={def.key}>
            {idx > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{def.label}</DropdownMenuLabel>
            {def.type === 'select' ? (
              <div className="p-1">
                <SelectFilterEditor
                  def={def}
                  current={filters[def.key]}
                  onChange={onFilterChange}
                />
              </div>
            ) : null}
            {def.type === 'multi' ? (
              <MultiFilterEditor def={def} current={filters[def.key]} onChange={onFilterChange} />
            ) : null}
            {def.type === 'date-range' ? (
              <DateRangeFilterEditor
                def={def}
                current={filters[def.key]}
                onChange={onFilterChange}
              />
            ) : null}
            {def.type === 'text' ? (
              <TextFilterEditor def={def} current={filters[def.key]} onChange={onFilterChange} />
            ) : null}
            {filters[def.key] ? (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  onFilterChange(def.key, null)
                }}
                className="text-xs text-foreground-muted"
              >
                <X className="h-3.5 w-3.5" /> {def.label}
              </DropdownMenuItem>
            ) : null}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// Toolbar root
// ---------------------------------------------------------------------------

function ToolbarBase<T>({
  q,
  filters,
  filterDefs,
  onSearchChange,
  onFilterChange,
  onClearFilters,
  className,
  children,
}: DataTableToolbarProps<T>) {
  const { t } = useTranslation('data-table')

  // Route children to fixed slots.
  let searchSlot: React.ReactNode = null
  let filtersSlot: React.ReactNode = null
  let actionsSlot: React.ReactNode = null

  React.Children.forEach(children, (child) => {
    if (child == null || typeof child === 'boolean') return
    const slot = getSlotName(child)
    if (slot === 'DataTableToolbar.Search') {
      searchSlot = child
    } else if (slot === 'DataTableToolbar.Filters') {
      filtersSlot = child
    } else if (slot === 'DataTableToolbar.Actions') {
      actionsSlot = child
    } else if (import.meta.env?.DEV) {
      console.warn(
        '[DataTableToolbar] Unknown child ignored. Wrap content in Toolbar.Search, Toolbar.Filters, or Toolbar.Actions.',
        child,
      )
    }
  })

  const placeholder = t('toolbar.search.placeholder')
  const filtersButtonLabel = t('toolbar.filters.button')
  const clearLabel = t('toolbar.filters.clear')

  const defaultSearch = (
    <DebouncedSearch value={q} onChange={onSearchChange} placeholder={placeholder} />
  )

  const hasFilterDefs = !!filterDefs?.length
  const chips = hasFilterDefs ? buildChips(filterDefs, filters) : []
  const hasActiveFilters = !!chips.length

  const defaultFilters = hasFilterDefs ? (
    <>
      <FilterDropdown
        defs={filterDefs}
        filters={filters}
        onFilterChange={onFilterChange}
        triggerLabel={filtersButtonLabel}
      />
      {chips.map((chip) => (
        <Badge key={chip.field} variant="soft" className="gap-1 pl-2 pr-1">
          <span className="text-foreground-muted">{chip.label}:</span>
          <span>{chip.display}</span>
          <button
            type="button"
            aria-label={`${clearLabel} — ${chip.label}`}
            onClick={() => onFilterChange(chip.field, null)}
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-surface-2"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          {clearLabel}
        </Button>
      ) : null}
    </>
  ) : null

  // Fixed visual order regardless of JSX child order:
  //   Search (left, grows) | Filters (middle) | Actions (right)
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3',
        className,
      )}
      data-testid="data-table-toolbar"
    >
      <div className="flex flex-1 min-w-0 items-center">{searchSlot ?? defaultSearch}</div>
      <div className="flex flex-wrap items-center gap-2">{filtersSlot ?? defaultFilters}</div>
      <div className="flex items-center gap-2">{actionsSlot}</div>
    </div>
  )
}

// Compound exports.
// The generic root needs to accept `<T>` props; React doesn't carry the type
// through `Object.assign`, so we expose the typed root as `Toolbar` and re-attach
// the static slot components.

export const DataTableToolbar = ToolbarBase as typeof ToolbarBase & {
  Search: typeof SearchSlot
  Filters: typeof FiltersSlot
  Actions: typeof ActionsSlot
}
DataTableToolbar.Search = SearchSlot
DataTableToolbar.Filters = FiltersSlot
DataTableToolbar.Actions = ActionsSlot

// Convenience alias matching the spec's `Toolbar.X` naming when imported as `Toolbar`.
export { DataTableToolbar as Toolbar }
