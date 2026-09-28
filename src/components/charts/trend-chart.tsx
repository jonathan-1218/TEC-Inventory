"use client"

import * as React from "react"
import { cn } from "cn"
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, usePlotArea } from "recharts"
import { useReducedMotion } from "motion/react"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  CHART,
  Readout,
  SERIES_COLORS,
  SERIES_DASH,
  SeriesKey,
  SrTable,
  formatDay,
  formatDayLong,
  formatNumber,
  mix,
  niceTicks,
  type SeriesMeta,
} from "./shared"

export type TrendSeries = { key: string; label: string; color?: string }
export type TrendPoint = Record<string, string | number>

const compact = new Intl.NumberFormat("en-IN", { notation: "compact" })

/**
 * Time series (1–3 series) drawn like a scope trace: the first series is the orange signal with a glow and a
 * gradient wash, the others are dashed/dotted lines. Legend buttons toggle series; the chart is keyboard
 * navigable (focus it, then ← →).
 */
export function TrendChart({
  data,
  series,
  xKey = "date",
  height = 260,
  formatX = formatDay,
  formatLabel = formatDayLong,
  formatValue = formatNumber,
  totals = true,
  summary,
  emptyMessage = "No activity in this range",
  className,
}: {
  /** One row per x value, e.g. { date: "2026-09-12", issued: 4, returned: 2 }. Dates as YYYY-MM-DD. */
  data: TrendPoint[]
  series: TrendSeries[]
  xKey?: string
  /** Plot height in px (legend excluded). */
  height?: number
  formatX?: (value: unknown) => string
  formatLabel?: (value: unknown) => string
  formatValue?: (n: number) => string
  /** Show each series' total over the range in the legend. */
  totals?: boolean
  /** Screen-reader summary; a sensible one is generated when omitted. */
  summary?: string
  emptyMessage?: string
  className?: string
}) {
  const still = useReducedMotion() ?? false // decide on first render; recharts' own check can freeze a line half-drawn
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const [hidden, setHidden] = React.useState<string[]>([])

  const meta: SeriesMeta[] = series.map((s, i) => ({
    key: s.key,
    label: s.label,
    color: s.color ?? SERIES_COLORS[i],
    dash: SERIES_DASH[i],
  }))
  const value = (d: TrendPoint, key: string) => Number(d[key]) || 0
  const sums = meta.map((s) => data.reduce((sum, d) => sum + value(d, s.key), 0))
  const allZero = sums.every((t) => t === 0)
  const peakIndex = data.length ? data.indexOf(peak(data, meta[0].key)) : -1
  const ticks = niceTicks(Math.max(0, ...data.flatMap((d) => meta.map((s) => value(d, s.key)))))
  const config = Object.fromEntries(meta.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig

  const text =
    summary ??
    (data.length === 0
      ? emptyMessage
      : `${meta.map((s, i) => `${s.label}: ${formatValue(sums[i])}`).join(", ")} between ${formatLabel(data[0][xKey])} and ${formatLabel(data.at(-1)?.[xKey])}.` +
        (allZero ? "" : ` ${meta[0].label} peaked on ${formatLabel(peak(data, meta[0].key)[xKey])}.`))

  const toggle = (key: string) =>
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : h.length < meta.length - 1 ? [...h, key] : h))

  return (
    <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
      {meta.length > 1 || totals ? (
        <div role="group" aria-label="Series" className="flex flex-wrap gap-x-6 gap-y-2">
          {meta.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={!hidden.includes(s.key)}
              disabled={meta.length === 1}
              onClick={() => toggle(s.key)}
              className="-mx-1.5 flex flex-col items-start gap-0.5 rounded-md px-1.5 py-0.5 text-left transition-opacity outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none aria-[pressed=false]:opacity-40"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <SeriesKey s={s} />
                {s.label}
              </span>
              {totals && <span className="font-mono text-lg leading-tight font-semibold tabular-nums">{formatValue(sums[i])}</span>}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        {data.length === 0 ? (
          <EmptyPlot height={height} message={emptyMessage} />
        ) : (
          <ChartContainer
            config={config}
            className="aspect-auto w-full [&_.trend-glow_.recharts-area-curve]:[filter:drop-shadow(0_0_5px_var(--glow))]"
            style={{ height, "--glow": mix(meta[0].color, 55) } as React.CSSProperties}
          >
            <AreaChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: meta[0].color, stopOpacity: 0.28 }} />
                  <stop offset="100%" style={{ stopColor: meta[0].color, stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="2 4" />
              <XAxis
                dataKey={xKey}
                tickFormatter={formatX}
                tickLine={false}
                axisLine={{ stroke: CHART.grid }}
                tickMargin={10}
                minTickGap={28}
              />
              <YAxis
                width={34}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                ticks={ticks}
                domain={[0, ticks.at(-1) ?? 4]}
                tickFormatter={(n: number) => compact.format(n)}
              />
              <Tooltip
                cursor={{ stroke: CHART.muted, strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => (
                  <Readout active={active} payload={payload} label={label} series={meta.filter((s) => !hidden.includes(s.key))} formatLabel={formatLabel} formatValue={formatValue} />
                )}
              />
              {meta
                .map((s, i) => (
                  <Area
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    hide={hidden.includes(s.key)}
                    type="monotoneX"
                    stroke={s.color}
                    strokeWidth={i === 0 ? 2 : 1.75}
                    strokeDasharray={s.dash}
                    strokeLinecap="round"
                    fill={i === 0 ? `url(#${uid}-fill)` : "transparent"}
                    className={i === 0 ? "trend-glow" : undefined}
                    dot={i === 0 && !allZero ? (p: DotProps) => <MarkerDot key={p.index} {...p} value={p.payload?.[s.key]} peak={peakIndex} last={data.length - 1} color={s.color} format={formatValue} /> : false}
                    activeDot={i === 0 ? <CrosshairDot color={s.color} /> : { r: 3.5, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
                    isAnimationActive={!still}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                ))
                // Draw the primary series last so it sits on top.
                .reverse()}
            </AreaChart>
          </ChartContainer>
        )}
        {data.length > 0 && allZero && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit rounded-full border border-border bg-card/90 px-3 py-1 font-mono text-[11px] text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </div>

      <figcaption className="sr-only">{text}</figcaption>
      {data.length > 0 && (
        <SrTable
          caption={text}
          columns={["Date", ...meta.map((s) => s.label)]}
          rows={data.map((d) => [formatLabel(d[xKey]), ...meta.map((s) => formatValue(value(d, s.key)))])}
        />
      )}
    </figure>
  )
}

function peak(data: TrendPoint[], key: string) {
  return data.reduce((best, d) => ((Number(d[key]) || 0) > (Number(best[key]) || 0) ? d : best), data[0])
}

/** Active point of the primary series: halo + dot, plus a horizontal hairline back to the y-axis (crosshair). */
function CrosshairDot({ cx, cy, color }: { cx?: number; cy?: number; color: string }) {
  const plot = usePlotArea()
  if (cx == null || cy == null) return null
  return (
    <g>
      {plot && <line x1={plot.x} x2={cx} y1={cy} y2={cy} stroke={CHART.muted} strokeWidth={1} strokeDasharray="3 3" />}
      <circle cx={cx} cy={cy} r={9} fill={mix(color, 22)} />
      <circle cx={cx} cy={cy} r={4} fill={color} stroke={CHART.surface} strokeWidth={2} />
    </g>
  )
}

type DotProps = { cx?: number; cy?: number; index?: number; value?: unknown; payload?: TrendPoint }

/** Static markers on the primary trace: the peak gets its value printed above, the latest point an end dot. */
function MarkerDot({ cx, cy, index, value, peak, last, color, format }: DotProps & { peak: number; last: number; color: string; format: (n: number) => string }) {
  if (cx == null || cy == null || (index !== peak && index !== last)) return <g />
  return (
    <g>
      {index === peak && (
        <text x={cx} y={cy - 9} textAnchor="middle" className="fill-foreground font-mono text-[10px] font-semibold tabular-nums">
          {format(Number(value) || 0)}
        </text>
      )}
      <circle cx={cx} cy={cy} r={index === last ? 3.5 : 2.5} fill={index === last ? color : CHART.surface} stroke={index === last ? CHART.surface : color} strokeWidth={index === last ? 2 : 1.5} />
    </g>
  )
}

/** Same footprint as a chart, for "no data yet". */
export function EmptyPlot({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="grid place-items-center rounded-md border border-dashed border-border"
      style={{ height, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${height / 4 - 1}px, ${mix(CHART.grid, 70)} ${height / 4 - 1}px ${height / 4}px)` }}
    >
      <p className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground">{message}</p>
    </div>
  )
}
