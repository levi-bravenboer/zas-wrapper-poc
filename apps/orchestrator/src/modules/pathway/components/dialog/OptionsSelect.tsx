import { type ReactElement, type ReactNode } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SelectOption = {
  value: string
  label: ReactNode
}

type Props = {
  value: string
  options: SelectOption[]
  onChange: (next: string) => void
  /** Placeholder shown when no value is set yet. */
  placeholder?: ReactNode
  /** Optional id forwarded to the trigger (for `<label htmlFor>`). */
  triggerId?: string
  /** Tailwind classes appended to the trigger (sizing, width). */
  triggerClassName?: string
}

// Thin wrapper around the shadcn `Select` parts used across the
// dialog dir (phase picker, predicate picker, node picker, aggregator
// picker, timing-kind picker). One signature instead of five 15-line
// JSX blobs.
export function OptionsSelect({
  value,
  options,
  onChange,
  placeholder,
  triggerId,
  triggerClassName,
}: Props): ReactElement {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={triggerId} className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
