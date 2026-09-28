"use client"

import { cn } from "cn"
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"
import { useReducedMotion } from "motion/react"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { parseDateInput, toDateInput } from "@/lib/dates"
import { CHART, LineKey, Readout, SERIES_COLORS, SERIES_DASH, SrTable, formatDay, formatDayLong, type SeriesMeta } from "./shared"

export type TimelineProject = { id: string; name: string; points: { date: string; progress: number }[] }

const pct = (n: number) => `${Math.round(n)}%`

/**
 * Progress (%) over time, one stepped line per project, with a marker at every progress update.
 * Up to 5 projects (each gets its own colour + dash pattern).
 */
export function ProgressTimeline({
  projects,
  end,
  height = 240,
  summary,
  className,
}: {
  projects: TimelineProject[]
  /** Extend every line flat to this day (YYYY-MM-DD), e.g. today. */
  end?: string
  height?: number
  summary?: string
  className?: string
}) {
  // ponytail: 5 series max so colours never cycle; pass the projects that matter (active / recently updated).
  const still = useReducedMotion() ?? false // decide on first render; recharts' own check can freeze a line half-drawn
  const list = projects.slice(0, 5)
  const meta: SeriesMeta[] = list.map((p, i) => ({ key: p.id, label: p.name, color: SERIES_COLORS[i], dash: SERIES_DASH[i] }))
  const config = Object.fromEntries(meta.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig

  // One row per date; each project carries its latest progress forward (a step line) and flags real updates.
  const dates = [...new Set([...list.flatMap((p) => p.points.map((pt) => pt.date)), ...(end ? [end] : [])])].sort()
  const rows = dates.map((date) => {
    const row: Record<string, number | string | boolean> = { date, t: parseDateInput(date).getTime() }
    for (const p of list) {
      const upto = p.points.filter((pt) => pt.date <= date).sort((a, b) => a.date.localeCompare(b.date))
      if (upto.length) row[p.id] = upto[upto.length - 1].progress
      if (p.points.some((pt) => pt.date === date)) row[`${p.id}__update`] = true
    }
    return row
  })

  const latest = (p: TimelineProject) => [...p.points].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.progress ?? 0
  const text =
    summary ?? `Progress over time for ${list.length} projects. ` + list.map((p) => `${p.name}: ${pct(latest(p))} after ${p.points.length} updates`).join("; ") + "."
  const dayOf = (t: unknown) => (t != null && Number.isFinite(Number(t)) ? toDateInput(new Date(Number(t))) : "")

  return (
    <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-hidden>
        {list.map((p, i) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <LineKey color={meta[i].color} dash={meta[i].dash} />
            {p.name}
            <span className="font-mono text-foreground tabular-nums">{pct(latest(p))}</span>
          </li>
        ))}
      </ul>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="2 4" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatDay(dayOf(t))}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            tickMargin={10}
            minTickGap={32}
          />
          <YAxis width={40} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={pct} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: CHART.muted, strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => (
              <Readout active={active} payload={payload} label={dayOf(label)} series={meta} formatLabel={formatDayLong} formatValue={pct} />
            )}
          />
          {meta
            .map((s, i) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="stepAfter"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
                connectNulls={false}
                dot={(d: { cx?: number; cy?: number; index?: number; payload?: Record<string, unknown> }) =>
                  d.payload?.[`${s.key}__update`] && d.cx != null && d.cy != null ? (
                    <circle key={d.index} cx={d.cx} cy={d.cy} r={i === 0 ? 4 : 3.5} fill={s.color} stroke={CHART.surface} strokeWidth={2} />
                  ) : (
                    <g key={d.index} />
                  )
                }
                activeDot={{ r: 4.5, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
                isAnimationActive={!still}
                animationDuration={900}
                animationEasing="ease-out"
              />
            ))
            .reverse()}
        </LineChart>
      </ChartContainer>
      <figcaption className="sr-only">{text}</figcaption>
      <SrTable
        caption={text}
        columns={["Project", "Update", "Progress"]}
        rows={list.flatMap((p) => p.points.map((pt) => [p.name, formatDayLong(pt.date), pct(pt.progress)]))}
      />
    </figure>
  )
}
