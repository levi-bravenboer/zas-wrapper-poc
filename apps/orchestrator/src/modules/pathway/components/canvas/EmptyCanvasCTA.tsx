import { Panel } from '@xyflow/react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  scaffoldPresent: boolean
}

export function EmptyCanvasCTA({ scaffoldPresent }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const Arrow = scaffoldPresent ? ArrowDown : ArrowUp
  const titleKey = scaffoldPresent ? 'canvas.emptyTitle' : 'canvas.emptyNoScaffoldTitle'
  const bodyKey = scaffoldPresent ? 'canvas.emptyBody' : 'canvas.emptyNoScaffold'
  return (
    <Panel
      position="top-center"
      className="!m-0"
      style={{ top: '50%', transform: 'translate(-50%, -50%)' }}
    >
      <div
        role="status"
        className="pointer-events-auto flex max-w-xs flex-col items-center gap-2 rounded-lg border border-dashed border-black/10 bg-white/90 px-5 py-4 text-center shadow-sm backdrop-blur"
      >
        <Arrow className="size-4 text-muted-foreground" strokeWidth={1.8} />
        <h3 className="text-sm font-semibold text-foreground">{t(titleKey)}</h3>
        <p className="text-xs text-muted-foreground">{t(bodyKey)}</p>
      </div>
    </Panel>
  )
}
