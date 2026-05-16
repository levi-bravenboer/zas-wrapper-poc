import { ArrowDown } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  scaffoldPresent: boolean
}

export function EmptyCanvasCTA({ scaffoldPresent }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
      <div
        role="status"
        className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-dashed border-black/15 bg-white/70 px-6 py-5 text-center shadow-sm backdrop-blur"
      >
        <ArrowDown className="size-5 text-muted-foreground" strokeWidth={1.8} />
        <h3 className="text-sm font-semibold text-foreground">{t('canvas.emptyTitle')}</h3>
        <p className="text-xs text-muted-foreground">
          {scaffoldPresent ? t('canvas.emptyBody') : t('canvas.emptyNoScaffold')}
        </p>
      </div>
    </div>
  )
}
