import { Workflow, type LucideIcon, type LucideProps } from 'lucide-react'
import { createElement, type ReactElement } from 'react'

import { LANE_KIND_ICONS, resolveLucideIcon } from './blockCatalogue.utils'

type IconProps = Omit<LucideProps, 'ref'>

export function BlockTypeIcon({
  icon,
  ...rest
}: { icon: string | undefined } & IconProps): ReactElement {
  return createElement(resolveLucideIcon(icon), rest)
}

export function LaneKindIcon({ code, ...rest }: { code: string } & IconProps): ReactElement {
  const Icon = (LANE_KIND_ICONS as Partial<Record<string, LucideIcon>>)[code] ?? Workflow
  return createElement(Icon, rest)
}
