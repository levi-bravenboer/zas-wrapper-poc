import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { InstrumentCharts } from './InstrumentCharts'
import { pickLatest } from './instrumentSummary'
import type { LusciiMeasurementSeries } from './types'

export interface InstrumentDetail {
  instrumentId: string
  instrumentName: string | null
  series: LusciiMeasurementSeries[]
}

export interface InstrumentDetailDialogProps {
  /** Instrument to inspect, or `null` when the dialog is closed. */
  detail: InstrumentDetail | null
  onClose: () => void
}

/** Drill-in for one metric: full charts (history) per series. */
export function InstrumentDetailDialog({
  detail,
  onClose,
}: InstrumentDetailDialogProps): ReactElement {
  const { t } = useTranslation('patient-profile')
  const latest = detail ? pickLatest(detail.series) : null
  const title = detail?.instrumentName ?? t('charts.unknown_instrument')

  return (
    <Dialog
      open={detail !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{title}</span>
            {latest ? <Badge variant="soft">{latest}</Badge> : null}
          </DialogTitle>
        </DialogHeader>
        {detail ? <InstrumentCharts series={detail.series} /> : null}
      </DialogContent>
    </Dialog>
  )
}
