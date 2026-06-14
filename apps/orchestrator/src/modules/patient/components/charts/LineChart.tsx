import { type ReactElement, useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

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
  [seriesId: string]: number | string | undefined
}

/**
 * Numeric / multi-numeric chart for an instrument's numeric items. Renders
 * with Recharts via shadcn `Chart`. Sparse series (< 3 points combined)
 * render dots-only without a connecting line per D-SPARSE.
 */
export function LineChart({ series }: LineChartProps): ReactElement | null {
  const { config, rows, totalPoints, unit } = useMemo(
    () => buildChartData(series),
    [series],
  )

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
              dot={
                dotsOnly
                  ? { r: 4, fill: `var(--${colorVar})`, strokeWidth: 0 }
                  : { r: 2, fill: `var(--${colorVar})`, strokeWidth: 0 }
              }
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
      rowMap.set(point.observed_at, row)
    }
  })

  const rows = [...rowMap.values()].toSorted((a, b) =>
    a.observed_at < b.observed_at ? -1 : a.observed_at > b.observed_at ? 1 : 0,
  )
  return { config, rows, totalPoints, unit }
}
