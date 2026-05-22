'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/style/cn'

export interface PickerComboboxProps<T> {
  value: string | null
  items: ReadonlyArray<T>
  getId: (item: T) => string
  getLabel: (item: T) => string
  renderItem?: (item: T) => ReactNode
  selected: T | null
  search: string
  onSearchChange: (q: string) => void
  onSelect: (item: T) => void
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  loadingLabel?: string | undefined
  isLoading?: boolean | undefined
  disabled?: boolean | undefined
  disabledIds?: ReadonlyArray<string> | undefined
  triggerClassName?: string | undefined
  contentClassName?: string | undefined
  ariaLabel?: string | undefined
  /** When true, render the Command body inline (no Popover/Trigger). */
  inline?: boolean | undefined
}

export function PickerCombobox<T>({
  value,
  items,
  getId,
  getLabel,
  renderItem,
  selected,
  search,
  onSearchChange,
  onSelect,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  isLoading = false,
  disabled = false,
  disabledIds,
  triggerClassName,
  contentClassName,
  ariaLabel,
  inline = false,
}: PickerComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const disabledSet = disabledIds ? new Set(disabledIds) : null
  const triggerLabel = selected ? getLabel(selected) : value ? value : placeholder

  const body = (
    <Command shouldFilter={false}>
      <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={onSearchChange} />
      <CommandList>
        <CommandEmpty>{isLoading ? (loadingLabel ?? emptyLabel) : emptyLabel}</CommandEmpty>
        <CommandGroup>
          {items.map((item) => {
            const id = getId(item)
            const isSelected = id === value
            const isDisabled = disabledSet?.has(id) ?? false
            return (
              <CommandItem
                key={id}
                value={id}
                disabled={isDisabled}
                onSelect={() => {
                  onSelect(item)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
                {renderItem ? renderItem(item) : <span>{getLabel(item)}</span>}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )

  if (inline) {
    return (
      <div
        className={cn('overflow-hidden', contentClassName)}
        aria-label={ariaLabel ?? placeholder}
      >
        {body}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-(--radix-popover-trigger-width) p-0', contentClassName)}>
        {body}
      </PopoverContent>
    </Popover>
  )
}
