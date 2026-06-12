import { Activity, FlaskConical, Scan, Stethoscope, type LucideIcon } from 'lucide-react'
import { type ReactElement } from 'react'

import { cn } from '@/lib/style/cn'

import type { AppointmentKind } from '../types'

type Variant = {
  readonly icon: LucideIcon
  readonly classes: string
}

const KIND_VARIANTS: Record<AppointmentKind, Variant> = {
  consultation: {
    icon: Stethoscope,
    classes: 'bg-teal-100 text-teal-700',
  },
  lab: {
    icon: FlaskConical,
    classes: 'bg-purple-100 text-purple-700',
  },
  imaging: {
    icon: Scan,
    classes: 'bg-blue-100 text-blue-700',
  },
  procedure: {
    icon: Activity,
    classes: 'bg-rose-100 text-rose-700',
  },
  other: {
    icon: Activity,
    classes: 'bg-slate-100 text-slate-700',
  },
}

const SIZE_CLASSES = {
  sm: 'size-7 [&_svg]:size-4',
  md: 'size-9 [&_svg]:size-5',
} as const

export type KindTileProps = {
  kind: AppointmentKind
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

export function KindTile({ kind, size = 'md', className }: KindTileProps): ReactElement {
  const variant = KIND_VARIANTS[kind]
  const Icon = variant.icon
  return (
    <div
      aria-hidden
      data-kind={kind}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        variant.classes,
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Icon />
    </div>
  )
}
