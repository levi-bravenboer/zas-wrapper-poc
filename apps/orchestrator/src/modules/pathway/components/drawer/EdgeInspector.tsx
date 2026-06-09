import { X } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { DerivedEdge } from '../../types'

type Props = {
  edge: DerivedEdge
  onClose: () => void
}

// EdgeInspector retired in chain slot #2 §3 — edge connectivity is now
// authored as `input_logic` rules on the target block instead of a
// row-level timing union. A proper rule inspector lands in §7
// alongside the input-logic-aware tests. This stub keeps the drawer
// surface alive so the canvas still has somewhere to "select" an
// edge while the new inspector ships.
export function EdgeInspector({ edge, onClose }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {t('inspector.edge.placeholderTitle', { defaultValue: 'Connection' })}
        </span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('inspector.edge.placeholderBody', {
          defaultValue:
            'Edge timing was retired in slot #2 §3. Author connectivity via input_logic rules on the target block; rule inspector lands in §7.',
        })}
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">predicate</dt>
        <dd>{edge.predicate}</dd>
        <dt className="text-muted-foreground">source</dt>
        <dd>{edge.source_block_id ?? '—'}</dd>
        <dt className="text-muted-foreground">target</dt>
        <dd>{edge.target_block_id}</dd>
      </dl>
    </div>
  )
}
