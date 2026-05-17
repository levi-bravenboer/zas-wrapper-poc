import {
  Calendar,
  ClipboardList,
  Clock,
  Flag,
  GitBranch,
  Hourglass,
  Link2,
  ListChecks,
  Mail,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

import type { BlockConfig, BlockSemantics, LaneKindCode } from './types'

// String → lucide component lookup. Backend catalogue references icons by
// kebab-case name (e.g. 'list-checks'); resolving via a map keeps the UI
// catalogue-driven without an import per type.
const LUCIDE_BY_NAME: Record<string, LucideIcon> = {
  calendar: Calendar,
  'clipboard-list': ClipboardList,
  clock: Clock,
  flag: Flag,
  'git-branch': GitBranch,
  hourglass: Hourglass,
  'link-2': Link2,
  'list-checks': ListChecks,
  mail: Mail,
  workflow: Workflow,
}

export const LANE_KIND_ICONS = {
  patient: Workflow,
  caregiver: ListChecks,
  system: Clock,
  external: Mail,
} as const satisfies Record<LaneKindCode, LucideIcon>

export function resolveLucideIcon(name: string | undefined): LucideIcon {
  if (!name) return Workflow
  return LUCIDE_BY_NAME[name] ?? Workflow
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

export function blockSemanticsSummary(
  semantics: BlockSemantics | undefined,
  config: BlockConfig | undefined,
): string | undefined {
  if (!semantics) return undefined
  const cfg = (config ?? {}) as Record<string, unknown>
  switch (semantics) {
    case 'appointment':
      return asString(cfg.kind)
    case 'task':
      return asString(cfg.assignee)
    case 'message':
      return asString(cfg.channel)
    case 'form': {
      const questions = asArray(cfg.questions)
      return questions ? `${questions.length}` : undefined
    }
    case 'decision':
      return asString(cfg.criterion)
    case 'milestone':
      return asString(cfg.note)
    case 'wait':
      return asString(cfg.event_type)
    case 'pathway_link':
      return asString(cfg.mode)
    default:
      return undefined
  }
}
