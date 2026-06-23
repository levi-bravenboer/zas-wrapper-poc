import { type ReactElement, useMemo } from 'react'
import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

import { alertColor } from './alertFlag'
import { shortDate, shortDateTime } from './dateLabel'
import type { NumericSeries } from './types'

const CHART_COLOR_VARS = [
  'color-chart-1',
  'color-chart-2',
  'color-chart-3',
  'color-chart-4',
  'color-chart-5',
] as const

export interface LineChartProps {
  /**
   * One or more numeric series that share an instrument. With ≥ 2 series the
   * chart renders multi-line on a shared y-axis (medically conventional for
   * blood-pressure sys + dia, see D-MULTI-SERIES). Single-series usage
   * collapses to a single line.
   */
  series: NumericSeries[]
}

interface ChartRow {
  observed_at: string
  // Keyed by series_id; value is number | undefined to allow missing samples.
  // A sibling `<series_id>__alert` key (see `alertKey`) carries the optional
  // Luscii alert flag string for that point.
  [seriesId: string]: number | string | undefined
}

const alertKey = (seriesId: string): string => `${seriesId}__alert`

// Loosely mirrors Recharts' dot-render props (the exported type is internal).
// Fields are `T | undefined` rather than optional so the function is assignable
// to Recharts' `DotType` under `exactOptionalPropertyTypes`.
interface DotRenderProps {
  cx?: number
  cy?: number
  payload?: ChartRow
  dataKey?: string | number | ((obj: unknown) => unknown) | undefined
  index?: number
}

/** Per-point dot coloured by the Luscii alert flag (passthrough) when present,
 *  else the series colour. Hidden when the sample is missing at this row. */
function renderDot(colorVar: string | undefined, baseRadius: number) {
  const seriesColor = `var(--${colorVar ?? 'color-chart-1'})`
  return function Dot({ cx, cy, payload, dataKey, index }: DotRenderProps): ReactElement | null {
    if (cx == null || cy == null || typeof dataKey !== 'string') return null
    const flag = payload?.[alertKey(dataKey)]
    const flagged = alertColor(typeof flag === 'string' ? flag : null)
    const r = flagged ? baseRadius + 1 : baseRadius
    return (
      <circle
        key={`${dataKey}-${index}`}
        cx={cx}
        cy={cy}
        r={r}
        fill={flagged ?? seriesColor}
      />
    )
  }
}

/**
 * Numeric / multi-numeric chart for an instrument's numeric items. Renders
 * with Recharts via shadcn `Chart`. Sparse series (< 3 points combined)
 * render dots-only without a connecting line per D-SPARSE.
 */
export function LineChart({ series }: LineChartProps): ReactElement | null {
  const { config, rows, totalPoints, unit } = useMemo(() => buildChartData(series), [series])

  if (rows.length === 0) return null

  const dotsOnly = totalPoints < 3

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <RechartsLineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="observed_at"
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={40}
          allowDecimals
          {...(unit
            ? { label: { value: unit, angle: -90, position: 'insideLeft', offset: 4 } }
            : {})}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => shortDateTime(String(value))}
              indicator="dot"
            />
          }
        />
        {series.map((s, index) => {
          const colorVar = CHART_COLOR_VARS[index % CHART_COLOR_VARS.length]
          return (
            <Line
              key={s.series_id}
              dataKey={s.series_id}
              name={s.label ?? s.item_id}
              type="monotone"
              stroke={`var(--${colorVar})`}
              strokeWidth={2}
              dot={renderDot(colorVar, dotsOnly ? 4 : 2)}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              strokeOpacity={dotsOnly ? 0 : 1}
            />
          )
        })}
        {series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </RechartsLineChart>
    </ChartContainer>
  )
}

interface BuiltChart {
  config: ChartConfig
  rows: ChartRow[]
  totalPoints: number
  unit: string | null
}

function buildChartData(series: NumericSeries[]): BuiltChart {
  const config: ChartConfig = {}
  const rowMap = new Map<string, ChartRow>()
  let totalPoints = 0
  let unit: string | null = null

  series.forEach((s, index) => {
    const colorVar = CHART_COLOR_VARS[index % CHART_COLOR_VARS.length]
    config[s.series_id] = {
      label: s.label ?? s.item_id,
      color: `var(--${colorVar})`,
    }
    if (!unit && s.unit) unit = s.unit
    for (const point of s.points) {
      totalPoints += 1
      const row = rowMap.get(point.observed_at) ?? { observed_at: point.observed_at }
      row[s.series_id] = point.value
      // Alert flag rides alongside the value under a sibling key so the custom
      // dot renderer can colour the point without a second data structure.
      if (point.alert_flag) row[alertKey(s.series_id)] = point.alert_flag
      rowMap.set(point.observed_at, row)
    }
  })

  const rows = [...rowMap.values()].toSorted((a, b) =>
    a.observed_at < b.observed_at ? -1 : a.observed_at > b.observed_at ? 1 : 0,
  )
  return { config, rows, totalPoints, unit }
}
