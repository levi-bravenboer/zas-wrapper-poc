import type { ReactElement, ReactNode } from 'react'

import type { components } from '@/lib/api/schema'

type BlockSource = NonNullable<components['schemas']['PathwayBlockType']['source']>

type Props = {
  source: BlockSource
  provider: string | null | undefined
  kind: string | null | undefined
  label: string
  icon?: ReactNode
}

/**
 * Small pill rendered at the top of a block inspector. Surfaces the
 * `source / provider / kind` provenance trio in a uniform shape across
 * native, external (e.g. `luscii.program`), and internal (`pathway.link`)
 * blocks so a future tenant integration ("show me every 'monitoring' block
 * regardless of provider") can group by the same metadata.
 *
 * Originally specced as a lift from `external-block-integrations` but no
 * generic chip landed there — this component fills the seam.
 */
export function InspectorHeaderChip({ source, provider, kind, label, icon }: Props): ReactElement {
  const dotted = provider && kind ? `${provider}.${kind}` : (provider ?? kind ?? source)
  return (
    <div
      data-slot="inspector-header-chip"
      className="inline-flex items-center gap-2 self-start rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]"
      style={{ borderColor: 'var(--hairline)' }}
    >
      {icon && (
        <span className="inline-flex size-4 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="font-medium text-foreground">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{dotted}</span>
    </div>
  )
}
