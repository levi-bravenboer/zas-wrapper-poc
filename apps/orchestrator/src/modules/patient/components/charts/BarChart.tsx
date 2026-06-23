import { type ReactElement, useMemo } from 'react'
import { Bar, CartesianGrid, Cell, BarChart as RechartsBarChart, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  type ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

import { alertColor } from './alertFlag'
import { shortDate, shortDateTime } from './dateLabel'
import type { OrdinalSeries } from './types'

export interface BarChartProps {
  series: OrdinalSeries
}

interface ChartRow {
  observed_at: string
  value: number
  alert_flag: string | null
}

/**
 * Discrete-tick bar chart for an ordinal series (Punten / Score / Sterren).
 * Y-domain is derived from the observed point range — NO hardcoded clinical
 * scale (D-NO-DERIVED). Discrete y-ticks render at integer steps within the
 * observed range so a "3 / 5" point reads cleanly without implying values
 * outside the data.
 */
export function BarChart({ series }: BarChartProps): ReactElement | null {
  const { config, rows, ticks, min, max } = useMemo(() => buildChartData(series), [series])

  if (rows.length === 0) return null

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <RechartsBarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
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
          allowDecimals={false}
          domain={[min, max]}
          {...(ticks.length ? { ticks } : {})}
          {...(series.unit
            ? { label: { value: series.unit, angle: -90, position: 'insideLeft', offset: 4 } }
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
        <Bar
          dataKey="value"
          name={series.label ?? series.item_id}
          fill="var(--color-chart-1)"
          isAnimationActive={false}
          radius={[3, 3, 0, 0]}
        >
          {rows.map((row) => {
            const flagged = alertColor(row.alert_flag)
            return <Cell key={row.observed_at} {...(flagged ? { fill: flagged } : {})} />
          })}
        </Bar>
      </RechartsBarChart>
    </ChartContainer>
  )
}

interface BuiltBar {
  config: ChartConfig
  rows: ChartRow[]
  ticks: number[]
  min: number
  max: number
}

function buildChartData(series: OrdinalSeries): BuiltBar {
  const config: ChartConfig = {
    value: {
      label: series.label ?? series.item_id,
      color: 'var(--color-chart-1)',
    },
  }
  const rows: ChartRow[] = series.points.map((p) => ({
    observed_at: p.observed_at,
    value: p.value,
    alert_flag: p.alert_flag ?? null,
  }))
  const values = rows.map((r) => r.value)
  // Bars grow from a zero baseline (or below, for negative scores) so a single
  // or constant point stays visible — a data-derived min would clip the bar to
  // zero height (e.g. a lone "5" with domain [5,6]).
  const min = values.length ? Math.min(0, Math.floor(Math.min(...values))) : 0
  const max = values.length ? Math.max(1, Math.ceil(Math.max(...values))) : 1
  // Integer ticks for tight ranges; defer to Recharts' auto ticks when the
  // span is wide so the axis doesn't crowd.
  const ticks: number[] = []
  if (max - min <= 10) {
    for (let v = min; v <= max; v += 1) ticks.push(v)
  }
  return { config, rows, ticks, min, max }
}
