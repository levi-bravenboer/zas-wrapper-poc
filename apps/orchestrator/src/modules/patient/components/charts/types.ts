import type { components } from '@/lib/api/schema'

export type LusciiMeasurementSeries = components['schemas']['LusciiMeasurementSeries']
export type LusciiNumericPoint = components['schemas']['LusciiNumericPoint']
export type LusciiOrdinalPoint = components['schemas']['LusciiOrdinalPoint']
export type LusciiCategoricalPoint = components['schemas']['LusciiCategoricalPoint']
export type LusciiFreeTextPoint = components['schemas']['LusciiFreeTextPoint']
export type LusciiUnknownPoint = components['schemas']['LusciiUnknownPoint']
export type LusciiMeasurementPoint = NonNullable<LusciiMeasurementSeries['points']>[number]
export type Archetype = LusciiMeasurementSeries['archetype']

// Narrowed series view per archetype. `points` is non-empty by backend
// contract — `project_series` never emits a series with zero points. The
// `Omit + &` shape forces TS to narrow `points` properly (a bare
// intersection lets `points` stay the union the OpenAPI client emits).
type SeriesBase = Omit<LusciiMeasurementSeries, 'archetype' | 'points'>

export type NumericSeries = SeriesBase & {
  archetype: 'numeric'
  points: LusciiNumericPoint[]
}
export type OrdinalSeries = SeriesBase & {
  archetype: 'ordinal'
  points: LusciiOrdinalPoint[]
}
export type CategoricalSeries = SeriesBase & {
  archetype: 'categorical'
  points: LusciiCategoricalPoint[]
}
export type FreeTextSeries = SeriesBase & {
  archetype: 'free_text'
  points: LusciiFreeTextPoint[]
}
export type UnknownSeries = SeriesBase & {
  archetype: 'unknown'
  points: LusciiUnknownPoint[]
}
