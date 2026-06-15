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
 *
 * Reason for the per-case casts below: the OpenAPI-generated
 * `LusciiMeasurementSeries` is a union that openapi-typescript does NOT
 * emit with a literal `points` discriminator — the `points` array stays the
 * full union after narrowing `series.archetype`. The project-local
 * `NumericSeries`/`OrdinalSeries`/etc. variants (`types.ts`) re-bind the
 * `points` array shape per archetype; each renderer wants the narrower
 * shape, and the switch-on-`archetype` makes the cast sound.
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
