import {
  Calendar,
  Clock,
  Flag,
  GitBranch,
  ListChecks,
  Mail,
  Workflow,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'
import { createElement, type ReactElement } from 'react'

import type { LaneKindCode } from './types'

const BLOCK_TYPE_ICONS = {
  appointment: Calendar,
  decision: GitBranch,
  milestone: Flag,
  timer: Clock,
  task: ListChecks,
  email: Mail,
} as const satisfies Record<string, LucideIcon>

const LANE_KIND_ICONS = {
  patient: Workflow,
  caregiver: ListChecks,
  system: Clock,
  external: Mail,
} as const satisfies Record<LaneKindCode, LucideIcon>

type IconProps = Omit<LucideProps, 'ref'>

export function BlockTypeIcon({ type, ...rest }: { type: string } & IconProps): ReactElement {
  const Icon = (BLOCK_TYPE_ICONS as Partial<Record<string, LucideIcon>>)[type] ?? Workflow
  return createElement(Icon, rest)
}

export function LaneKindIcon({ code, ...rest }: { code: string } & IconProps): ReactElement {
  const Icon = (LANE_KIND_ICONS as Partial<Record<string, LucideIcon>>)[code] ?? Workflow
  return createElement(Icon, rest)
}
