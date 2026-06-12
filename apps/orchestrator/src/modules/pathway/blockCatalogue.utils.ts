import {
  Calendar,
  ClipboardList,
  Clock,
  Flag,
  GitBranch,
  GitMerge,
  Hourglass,
  Link2,
  ListChecks,
  Mail,
  Play,
  Signature,
  Square,
  Stethoscope,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

import { CONFIG_SCHEMAS } from './configSchemas'
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
  'git-merge': GitMerge,
  hourglass: Hourglass,
  'link-2': Link2,
  'list-checks': ListChecks,
  mail: Mail,
  play: Play,
  signature: Signature,
  square: Square,
  stethoscope: Stethoscope,
  users: Users,
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

export function blockSemanticsSummary(
  semantics: BlockSemantics | undefined,
  config: BlockConfig | undefined,
): string | undefined {
  if (!semantics) return undefined
  const schema = CONFIG_SCHEMAS[semantics]
  const parsed = schema.safeParse(config ?? {})
  if (!parsed.success) return undefined
  const data = parsed.data
  switch (semantics) {
    case 'appointment':
      return 'kind' in data ? data.kind : undefined
    case 'treatment':
      return 'title' in data ? data.title : undefined
    case 'task':
      return 'assignee' in data ? data.assignee : undefined
    case 'message':
      return 'channel' in data ? data.channel : undefined
    case 'form':
      return 'questions' in data && data.questions ? `${data.questions.length}` : undefined
    case 'decision':
      return 'question' in data ? data.question : undefined
    case 'milestone':
      return 'note' in data ? data.note : undefined
    case 'wait':
      return 'event_type' in data ? data.event_type : undefined
    case 'pathway_link':
      return 'mode' in data ? data.mode : undefined
    default:
      return undefined
  }
}
