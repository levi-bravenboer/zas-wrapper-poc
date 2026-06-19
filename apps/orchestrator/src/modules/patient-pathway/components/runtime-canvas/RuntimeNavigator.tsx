import { MiniMap, Panel, useReactFlow } from '@xyflow/react'
import { Focus, Minus, Plus } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { VIEWPORT_TRANSITION_MS, ZOOM_DURATION_MS } from '@/modules/pathway/constants/animation'
import { CANVAS_VIEWPORT } from '@/modules/pathway/constants/canvas'

import type { RuntimeFlowNode } from './RuntimeBlockNode'

const MINIMAP_WIDTH = 220
const MINIMAP_HEIGHT = 130

export interface RuntimeNavigatorProps {
  nodeColor: (node: RuntimeFlowNode) => string
}

// Mirrors the builder's `NavigatorPanel` chrome + zoom/fit buttons exactly.
// The minimap itself is ReactFlow's built-in (the builder's `BuilderMiniMap`
// is bound to builder geometry, which the runtime auto-layout doesn't use).
export function RuntimeNavigator({ nodeColor }: RuntimeNavigatorProps): ReactElement {
  const { t } = useTranslation('pathway')
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel
      position="bottom-right"
      className="!m-3 overflow-hidden rounded-xl border border-[color:var(--hairline)] bg-white/90 shadow-[0_8px_24px_rgba(11,26,23,0.08)] backdrop-blur-md"
    >
      <MiniMap
        pannable
        zoomable
        nodeColor={nodeColor as (node: { data?: unknown }) => string}
        nodeStrokeWidth={2}
        nodeBorderRadius={4}
        maskColor="color-mix(in srgb, var(--color-foreground) 6%, transparent)"
        ariaLabel={t('minimap.label')}
        className="!relative !m-0 !rounded-none !border-0 !bg-transparent !shadow-none"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      />
      <div className="flex items-center justify-end gap-0.5 border-t border-[color:var(--hairline)] bg-white/60 px-1 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('minimap.zoomOut')}
          onClick={() => zoomOut({ duration: ZOOM_DURATION_MS })}
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('minimap.zoomIn')}
          onClick={() => zoomIn({ duration: ZOOM_DURATION_MS })}
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={t('minimap.fit')}
          onClick={() =>
            fitView({ duration: VIEWPORT_TRANSITION_MS, padding: CANVAS_VIEWPORT.fitPadding })
          }
        >
          <Focus className="size-3.5" />
        </Button>
      </div>
    </Panel>
  )
}
