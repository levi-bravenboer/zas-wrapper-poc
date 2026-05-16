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

const BLOCK_TYPE_ICONS: Record<string, LucideIcon> = {
  appointment: Calendar,
  decision: GitBranch,
  milestone: Flag,
  timer: Clock,
  task: ListChecks,
  email: Mail,
}

const LANE_KIND_ICONS: Record<string, LucideIcon> = {
  patient: Workflow,
  caregiver: ListChecks,
  system: Clock,
  external: Mail,
}

type IconProps = Omit<LucideProps, 'ref'>

export function BlockTypeIcon({ type, ...rest }: { type: string } & IconProps): ReactElement {
  return createElement(BLOCK_TYPE_ICONS[type] ?? Workflow, rest)
}

export function LaneKindIcon({ code, ...rest }: { code: string } & IconProps): ReactElement {
  return createElement(LANE_KIND_ICONS[code] ?? Workflow, rest)
}
