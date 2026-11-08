import { Activity, ChevronsUpDown } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  programName: string | null
  subLine: string | null
  empty?: boolean
}

/**
 * Title-overlay glass chip for a Luscii block. Same shape at every size —
 * only the Luscii-corner badge is rendered separately by the block frame.
 *
 * Empty-state copy ("Luscii Program · Pick one") triggers when `programName`
 * is null. Otherwise the program name + sub-line (protocol · mode) render.
 */
export function LusciiProgramHeader({ programName, subLine, empty }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <div
      data-slot="luscii-program-header"
      className="pointer-events-none absolute left-3 top-2.5 z-10 inline-flex max-w-[calc(100%-72px)] items-center gap-2 rounded-full border border-white/70 bg-white/85 px-2.5 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur"
      style={{ backdropFilter: 'blur(12px) saturate(180%)' }}
    >
      <span
        className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-[4px]"
        style={{
          background: 'color-mix(in srgb, var(--lane-external) 16%, white)',
          color: 'var(--lane-external)',
        }}
      >
        <Activity className="size-3.5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 leading-[1.15]">
        <div className="truncate text-[12.5px] font-semibold tracking-tight text-foreground">
          {empty
            ? t('canvas.luscii.headerEmpty')
            : (programName ?? t('inspector.lusciiProgram.program'))}
        </div>
        {!empty && subLine && (
          <div className="truncate font-mono text-[10px] text-muted-foreground">{subLine}</div>
        )}
      </div>
      {empty && <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )
}
