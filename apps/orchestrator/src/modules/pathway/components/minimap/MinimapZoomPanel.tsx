import { MiniMap, useReactFlow } from '@xyflow/react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { laneAccent } from '../../canvasLayout'
import type { PathwayLane } from '../../types'

export function MinimapZoomPanel(): ReactElement {
  const { t } = useTranslation('pathway')
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div
      role="group"
      aria-label={t('minimap.label')}
      className="pointer-events-auto absolute right-4 bottom-4 z-10 flex flex-col items-end gap-2"
    >
      <MiniMap
        className="!rounded-lg !border !border-[color:var(--hairline)] !bg-white/80 !shadow-md backdrop-blur-md"
        pannable
        zoomable
        ariaLabel={t('minimap.label')}
        nodeColor={(node) => {
          const lane =
            node.data && 'lane' in node.data ? (node.data.lane as PathwayLane | null) : null
          return lane ? laneAccent(lane) : '#cbd1d8'
        }}
        nodeStrokeWidth={0}
        maskColor="rgba(11,26,23,0.06)"
      />
      <div className="inline-flex items-center gap-1 rounded-md border bg-white/80 px-1.5 py-1 shadow-sm backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('minimap.zoomOut')}
          onClick={() => zoomOut()}
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('minimap.zoomIn')}
          onClick={() => zoomIn()}
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('minimap.fit')}
          onClick={() => fitView({ duration: 200 })}
        >
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
