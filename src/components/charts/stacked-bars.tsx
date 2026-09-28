"use client"

import * as React from "react"
import { cn } from "cn"
import { Bar, BarChart, BarStack, CartesianGrid, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts"
import { useReducedMotion } from "motion/react"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { CHART, INVENTORY_SERIES, Readout, SeriesKey, SrTable, formatNumber, mix, type SeriesMeta, type StackedRow, type StackedSeries } from "./shared"

/**
 * Stacked bars per category, horizontal by default (reads well with many categories).
 * Totals sit at the bar ends; each segment has a hover readout; the legend shows series totals.
 */
export function StackedBars({
  data,
  series = INVENTORY_SERIES,
  orientation = "horizontal",
  height,
  formatValue = formatNumber,
  summary,
  className,
}: {
  /** One row per category: { label: "Sensor", available: 32, issued: 6, damaged: 1, underRepair: 2 }. */
  data: StackedRow[]
  series?: StackedSeries[]
  orientation?: "horizontal" | "vertical"
  /** Plot height; horizontal defaults to 34px per category. */
  height?: number
  formatValue?: (n: number) => string
  summary?: string
  className?: string
}) {
  const still = useReducedMotion() ?? false // decide on first render; recharts' own check can freeze a line half-drawn
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const horizontal = orientation === "horizontal"
  const meta: SeriesMeta[] = series.map((s) => ({ key: s.key, label: s.label, color: s.color ?? CHART.grey, mark: s.hatch ? "hatch" : "box" }))
  const fillOf = (s: StackedSeries) => (s.hatch ? `url(#${uid}-hatch-${s.key})` : (s.color ?? CHART.grey))
  const num = (row: StackedRow, key: string) => Number(row[key]) || 0
  const totals = new Map(data.map((row) => [row.label, series.reduce((sum, s) => sum + num(row, s.key), 0)]))
  const seriesTotals = series.map((s) => data.reduce((sum, row) => sum + num(row, s.key), 0))
  const plotHeight = height ?? (horizontal ? Math.max(120, data.length * 34 + 16) : 260)
  const config = Object.fromEntries(meta.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig

  const text =
    summary ??
    `${data.length} categories. ` +
      data.map((row) => `${row.label}: ${series.map((s) => `${num(row, s.key)} ${s.label.toLowerCase()}`).join(", ")}`).join("; ") +
      "."

  const categoryAxis = {
    dataKey: "label",
    type: "category" as const,
    tickLine: false,
    axisLine: false,
  }
  const valueAxis = { type: "number" as const, allowDecimals: false, tickLine: false, axisLine: false, tickCount: 5 }

  return (
    <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-hidden>
        {meta.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <SeriesKey s={s} />
            {s.label}
            <span className="font-mono text-foreground tabular-nums">{formatValue(seriesTotals[i])}</span>
          </li>
        ))}
      </ul>

      <ChartContainer
        config={config}
        className="aspect-auto w-full [&_.recharts-cartesian-axis.yAxis_.recharts-cartesian-axis-tick_text]:font-sans [&_.recharts-cartesian-axis.yAxis_.recharts-cartesian-axis-tick_text]:text-xs"
        style={{ height: plotHeight }}
      >
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 4, right: horizontal ? 4 : 8, bottom: 0, left: 0 }}
          barCategoryGap={horizontal ? 9 : "28%"}
          maxBarSize={24}
        >
          <defs>
            {series
              .filter((s) => s.hatch)
              .map((s) => (
                <pattern key={s.key} id={`${uid}-hatch-${s.key}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="5" height="5" style={{ fill: mix(s.color ?? CHART.grey, 10) }} />
                  <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: s.color ?? CHART.grey }} strokeWidth="1.6" />
                </pattern>
              ))}
          </defs>
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} stroke={CHART.grid} strokeDasharray="2 4" />
          {horizontal ? (
            <>
              <XAxis {...valueAxis} tickMargin={6} />
              {/* ponytail: width from label length (~6.6px per 12px-sans char), not "auto" — auto re-measures to a
                  too-narrow axis when the chart re-renders mid route transition. Upgrade: canvas measureText. */}
              <YAxis {...categoryAxis} width={Math.min(160, 14 + 6.6 * Math.max(...data.map((d) => String(d.label).length), 4))} tickMargin={8} />
              {/* Right-hand axis on the same categories, used only to print each bar's total. */}
              <YAxis
                {...categoryAxis}
                yAxisId="total"
                orientation="right"
                width={36}
                tickMargin={6}
                tickFormatter={(label: string) => formatValue(totals.get(label) ?? 0)}
                className="[&_text]:fill-foreground! [&_text]:font-semibold"
              />
            </>
          ) : (
            <>
              <XAxis {...categoryAxis} tickMargin={8} interval={0} />
              <YAxis {...valueAxis} width={34} />
            </>
          )}
          <Tooltip
            cursor={{ fill: mix(CHART.muted, 10) }}
            content={({ active, payload, label }) => (
              <Readout active={active} payload={payload} label={label} series={meta} formatLabel={String} formatValue={formatValue} total />
            )}
          />
          <BarStack radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={fillOf(s)}
                shape={(p: BarShapeProps) => <Segment {...p} horizontal={horizontal} />}
                isAnimationActive={!still}
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </BarStack>
        </BarChart>
      </ChartContainer>

      <figcaption className="sr-only">{text}</figcaption>
      <SrTable
        caption={text}
        columns={["Category", ...series.map((s) => s.label), "Total"]}
        rows={data.map((row) => [row.label, ...series.map((s) => formatValue(num(row, s.key))), formatValue(totals.get(row.label) ?? 0)])}
      />
    </figure>
  )
}

/** A segment with a 2px surface gap at its far end, so stacked neighbours read apart without outlines. */
function Segment({ x, y, width, height, fill, horizontal }: BarShapeProps & { horizontal: boolean }) {
  const w = Math.max(0, horizontal ? width - 2 : width)
  const h = Math.max(0, horizontal ? height : height - 2)
  if (!w || !h) return <g />
  return <rect x={x} y={horizontal ? y : y + 2} width={w} height={h} fill={fill} />
}
