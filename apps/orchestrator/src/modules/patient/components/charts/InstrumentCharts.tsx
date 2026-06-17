import { type ReactElement } from 'react'

import { isAllNumeric } from './instrumentSummary'
import { LineChart } from './LineChart'
import { renderChartForSeries } from './registry'
import type { LusciiMeasurementSeries, NumericSeries } from './types'

export interface InstrumentChartsProps {
  series: LusciiMeasurementSeries[]
}

/** Full chart body for one instrument: numeric-only instruments compose into a
 *  single multi-line chart (D-MULTI-SERIES); otherwise one chart per series. */
export function InstrumentCharts({ series }: InstrumentChartsProps): ReactElement {
  if (isAllNumeric(series)) {
    // reason: isAllNumeric guarantees every series.archetype is 'numeric', but
    // TS can't narrow an array-wide invariant from a predicate function.
    return <LineChart series={series as NumericSeries[]} />
  }
  return (
    <div className="flex flex-col gap-4">
      {series.map((s) => (
        <div key={s.series_id} className="flex flex-col gap-2">
          {series.length > 1 && s.label ? (
            <h4 className="text-xs font-medium text-foreground-muted">{s.label}</h4>
          ) : null}
          {renderChartForSeries(s)}
        </div>
      ))}
    </div>
  )
}
