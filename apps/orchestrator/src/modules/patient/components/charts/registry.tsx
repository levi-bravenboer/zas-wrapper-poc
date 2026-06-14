import { type ReactElement } from 'react'

import { BarChart } from './BarChart'
import { ChipStreamTimeline } from './ChipStreamTimeline'
import { FreeTextLog } from './FreeTextLog'
import { LineChart } from './LineChart'
import type {
  CategoricalSeries,
  FreeTextSeries,
  LusciiMeasurementSeries,
  NumericSeries,
  OrdinalSeries,
  UnknownSeries,
} from './types'
import { UnknownLog } from './UnknownLog'

/**
 * Archetype-keyed chart dispatch. The caller passes a series; this returns
 * the rendered React element for the matching renderer. Multi-numeric
 * instrument grouping (sys + dia on one chart) happens in the
 * `<InstrumentCard>` BEFORE this dispatch — the registry handles ONE series
 * at a time.
 */
export function renderChartForSeries(series: LusciiMeasurementSeries): ReactElement {
  switch (series.archetype) {
    case 'numeric':
      return <LineChart series={[series as NumericSeries]} />
    case 'ordinal':
      return <BarChart series={series as OrdinalSeries} />
    case 'categorical':
      return <ChipStreamTimeline series={series as CategoricalSeries} />
    case 'free_text':
      return <FreeTextLog series={series as FreeTextSeries} />
    case 'unknown':
      return <UnknownLog series={series as UnknownSeries} />
    default: {
      // Exhaustiveness check — narrows to `never` if a new archetype lands
      // without a renderer. The `satisfies` keeps the assertion at the
      // statement level so there is no unused-local warning.
      series.archetype satisfies never
      return <UnknownLog series={series as UnknownSeries} />
    }
  }
}

