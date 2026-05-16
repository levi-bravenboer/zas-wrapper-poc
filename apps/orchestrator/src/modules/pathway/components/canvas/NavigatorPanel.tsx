import { Panel, useReactFlow } from '@xyflow/react'
import { Focus, Minus, Plus } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { CanvasGeometry } from '../../canvasLayout'
import type { PathwayBlock, PathwayEdge, PathwayLane, PathwayPhase } from '../../types'

import { BuilderMiniMap } from './BuilderMiniMap'

type Props = {
  phases: PathwayPhase[]
  lanes: PathwayLane[]
  blocks: PathwayBlock[]
  edges: PathwayEdge[]
  geometry: CanvasGeometry
}

export function NavigatorPanel({
  phases,
  lanes,
  blocks,
  edges,
  geometry,
}: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel
      position="bottom-right"
      className="!m-3 overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-white/90 shadow-[0_8px_24px_rgba(11,26,23,0.08)] backdrop-blur-md"
    >
      <BuilderMiniMap
        phases={phases}
        lanes={lanes}
        blocks={blocks}
        edges={edges}
        geometry={geometry}
        ariaLabel={t('minimap.label')}
      />
      <div className="flex items-center justify-end gap-0.5 border-t border-[color:var(--hairline)] bg-white/60 px-1 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('minimap.zoomOut')}
          onClick={() => zoomOut({ duration: 160 })}
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('minimap.zoomIn')}
          onClick={() => zoomIn({ duration: 160 })}
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('minimap.fit')}
          onClick={() => fitView({ duration: 240, padding: 0.18 })}
        >
          <Focus className="size-3.5" />
        </Button>
      </div>
    </Panel>
  )
}
