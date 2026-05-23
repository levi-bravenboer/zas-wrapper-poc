import { AlertTriangle, Users } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { BlockTypeIcon } from '../../../blockCatalogue'
import type { LusciiProgramData } from '../../canvas/nodes/external/luscii/types'

type Props = {
  program: LusciiProgramData
}

/** Read-only "Program contents" card. Mirrors what the Luscii inspector
 * shows for instruments / alert thresholds / care network so the pathway
 * author can verify scope without leaving the builder. Edits live in Luscii
 * Builder — copy in the header makes that explicit. */
export function LusciiProgramContentsCard({ program }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const instruments = program.instruments ?? []
  const thresholds = program.alert_thresholds ?? []
  const careNetwork = program.care_network ?? null

  return (
    <section
      className="mt-4 flex flex-col gap-3 rounded-md border bg-card p-3 text-xs"
      style={{ borderColor: 'var(--hairline)' }}
      aria-label={t('inspector.lusciiProgram.contents.heading')}
    >
      <header className="flex flex-col gap-1">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('inspector.lusciiProgram.contents.heading')}
        </h4>
        <p className="text-[11px] text-muted-foreground">
          {t('inspector.lusciiProgram.contents.luscii_authored')}
        </p>
      </header>

      <ContentsSection
        title={t('inspector.lusciiProgram.contents.instrumentsHeader')}
        empty={instruments.length === 0}
        emptyLabel={t('inspector.lusciiProgram.contents.instrumentsEmpty')}
      >
        <ul className="flex flex-col gap-1.5">
          {instruments.map((inst) => (
            <li key={inst.code} className="flex items-center gap-2">
              <BlockTypeIcon
                icon={inst.icon}
                className="size-3.5 text-muted-foreground"
                strokeWidth={1.7}
              />
              <span className="flex-1 truncate text-foreground">{inst.label}</span>
              <span className="text-[10.5px] text-muted-foreground">{inst.cadence}</span>
            </li>
          ))}
        </ul>
      </ContentsSection>

      <ContentsSection
        title={t('inspector.lusciiProgram.contents.thresholdsHeader')}
        empty={thresholds.length === 0}
        emptyLabel={t('inspector.lusciiProgram.contents.thresholdsEmpty')}
      >
        <ul className="flex flex-col gap-1.5">
          {thresholds.map((th, idx) => (
            <li key={`${th.label}-${idx}`} className="flex items-start gap-2">
              <AlertTriangle className="mt-px size-3.5 text-amber-500 shrink-0" strokeWidth={1.7} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-foreground">{th.label}</span>
                <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                  {th.rule}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </ContentsSection>

      <ContentsSection
        title={t('inspector.lusciiProgram.contents.careNetworkHeader')}
        empty={!careNetwork}
        emptyLabel={t('inspector.lusciiProgram.contents.careNetworkEmpty')}
      >
        <div className="flex items-start gap-2">
          <Users className="mt-px size-3.5 text-muted-foreground shrink-0" strokeWidth={1.7} />
          <p className="flex-1 whitespace-pre-line text-foreground">{careNetwork}</p>
        </div>
      </ContentsSection>
    </section>
  )
}

function ContentsSection({
  title,
  empty,
  emptyLabel,
  children,
}: {
  title: string
  empty: boolean
  emptyLabel: string
  children: ReactElement
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h5>
      {empty ? <p className="text-[11px] text-muted-foreground">{emptyLabel}</p> : children}
    </div>
  )
}
