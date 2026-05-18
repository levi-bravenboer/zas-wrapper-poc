import { Search } from 'lucide-react'
import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/style/cn'

import { toolbarSearchBox, toolbarSearchInput } from '../styles'

export interface DebouncedSearchProps {
  value: string | null
  onChange: (next: string | null) => void
  placeholder: string
  className?: string
}

export function DebouncedSearch({
  value,
  onChange,
  placeholder,
  className,
}: DebouncedSearchProps) {
  const [local, setLocal] = React.useState<string>(value ?? '')
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmitted = React.useRef<string | null>(value)

  React.useEffect(() => {
    const incoming = value ?? ''
    if (incoming !== local && (value ?? null) !== lastEmitted.current) setLocal(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  React.useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <div className={cn(toolbarSearchBox, className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted"
      />
      <Input
        type="search"
        value={local}
        onChange={(e) => {
          const next = e.target.value
          setLocal(next)
          if (timer.current !== null) clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            const normalised = next.trim().length === 0 ? null : next
            lastEmitted.current = normalised
            onChange(normalised)
          }, 300)
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={toolbarSearchInput}
      />
    </div>
  )
}
