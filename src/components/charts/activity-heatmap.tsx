"use client"

import * as React from "react"
import { cn } from "cn"
import { monthShort, parseDateInput, toDateInput, todayNoonUTC } from "@/lib/dates"
import { CHART, formatDay, formatDayLong, formatNumber, mix } from "./shared"

export type HeatmapDay = { date: string; count: number }

const LEVELS = [mix(CHART.muted, 13), mix(CHART.brand, 30), mix(CHART.brand, 55), mix(CHART.brand, 80), CHART.brand]
const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""]
const DAY = 86_400_000

const scrollToEnd = (el: HTMLDivElement | null) => {
  if (el) el.scrollLeft = el.scrollWidth
}

/**
 * GitHub-style calendar (weeks run left→right, Monday on top) with a 5-step orange scale.
 * Hover a day, or focus the grid and use the arrow keys, to read it. Scrolls sideways on narrow screens.
 */
export function ActivityHeatmap({
  data,
  weeks = 26,
  end,
  unit = "checkouts",
  summary,
  className,
}: {
  /** Days with activity (missing days count as 0), dates as YYYY-MM-DD. */
  data: HeatmapDay[]
  weeks?: number
  /** Last day shown (YYYY-MM-DD); defaults to today in the club's time zone. */
  end?: string
  /** Plural noun for counts, e.g. "checkouts", "updates". */
  unit?: string
  summary?: string
  className?: string
}) {
  const figureRef = React.useRef<HTMLElement>(null)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [active, setActive] = React.useState<{ i: number; left: number; top: number } | null>(null)

  const counts = new Map(data.map((d) => [d.date, d.count]))
  const endDate = end ? parseDateInput(end) : todayNoonUTC()
  const start = endDate.getTime() - ((endDate.getUTCDay() + 6) % 7) * DAY - (weeks - 1) * 7 * DAY
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const t = start + i * DAY
    const date = toDateInput(new Date(t))
    return { date, count: counts.get(date) ?? 0, future: t > endDate.getTime() }
  })
  const lastIndex = cells.findLastIndex((c) => !c.future)
  const max = Math.max(0, ...cells.map((c) => c.count))
  const level = (n: number) => (n === 0 ? 0 : Math.ceil((n / max) * 4))

  const shown = cells.filter((c) => !c.future)
  const total = shown.reduce((sum, c) => sum + c.count, 0)
  const busiest = shown.reduce((best, c) => (c.count > best.count ? c : best), shown[0])
  const text =
    summary ??
    `${formatNumber(total)} ${unit} over the last ${weeks} weeks, on ${shown.filter((c) => c.count).length} days.` +
      (total ? ` Busiest day ${formatDayLong(busiest.date)} with ${busiest.count}.` : "")

  // Month labels on the first column of each month (skipped when they'd collide with the previous one).
  const months: { col: number; label: string }[] = []
  for (let col = 0; col < weeks; col++) {
    const d = parseDateInput(cells[col * 7].date)
    const prev = col > 0 ? parseDateInput(cells[(col - 1) * 7].date) : null
    if (!prev || prev.getUTCMonth() !== d.getUTCMonth()) {
      if (months.length && col - months[months.length - 1].col < 3) months.pop()
      months.push({ col, label: monthShort(d) })
    }
  }

  const show = (i: number) => {
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)
    const fig = figureRef.current
    if (!cell || !fig) return
    const c = cell.getBoundingClientRect()
    const f = fig.getBoundingClientRect()
    const left = Math.min(Math.max(c.left - f.left + c.width / 2, 72), f.width - 72)
    setActive({ i, left, top: c.top - f.top })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key]
    const current = active?.i ?? lastIndex
    const next = step !== undefined ? current + step : e.key === "Home" ? 0 : e.key === "End" ? lastIndex : null
    if (next === null) return
    e.preventDefault()
    const i = Math.min(Math.max(next, 0), lastIndex)
    gridRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
    show(i)
  }

  const cols = { gridTemplateColumns: `repeat(${weeks}, var(--cell))` }
  const activeCell = active ? cells[active.i] : null

  return (
    <figure ref={figureRef} className={cn("relative flex min-w-0 flex-wrap items-end gap-x-10 gap-y-4", className)}>
      <div className="flex max-w-full min-w-0 flex-col gap-2">
        <div ref={scrollToEnd} className="overflow-x-auto pb-1">
          <div className="grid w-max grid-cols-[auto_auto] gap-x-1 [--cell:13px] sm:[--cell:17px]">
            <span className="sticky left-0 z-[1] bg-card" />
            <div className="relative grid h-4 gap-[3px] font-mono text-[10px] text-muted-foreground" style={cols} aria-hidden>
              {months.map((m) => (
                <span key={m.col} className="whitespace-nowrap" style={{ gridColumn: `${m.col + 1} / span 3` }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="sticky left-0 z-[1] grid grid-rows-7 gap-[3px] bg-card pr-1 font-mono text-[10px] leading-none text-muted-foreground" aria-hidden>
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="flex items-center">
                  {d}
                </span>
              ))}
            </div>
            <div
              ref={gridRef}
              role="group"
              tabIndex={0}
              aria-label={`${text} Use the arrow keys to read each day.`}
              onKeyDown={onKeyDown}
              onFocus={() => active === null && show(lastIndex)}
              onBlur={() => setActive(null)}
              onPointerOver={(e) => {
                const i = (e.target as HTMLElement).closest<HTMLElement>("[data-i]")?.dataset.i
                if (i !== undefined && !cells[Number(i)].future) show(Number(i))
              }}
              onPointerLeave={() => setActive(null)}
              className="grid grid-flow-col grid-rows-7 gap-[3px] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              style={cols}
            >
              {cells.map((c, i) => (
                <span
                  key={c.date}
                  data-i={i}
                  className={cn(
                    "aspect-square rounded-[3px] transition-opacity duration-500 starting:opacity-0 motion-reduce:transition-none",
                    c.future && "invisible",
                    active?.i === i && "ring-[1.5px] ring-foreground ring-offset-1 ring-offset-card"
                  )}
                  style={{ background: LEVELS[level(c.count)], transitionDelay: `${Math.floor(i / 7) * 12}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground" aria-hidden>
          Less
          {LEVELS.map((bg, i) => (
            <span key={i} className="size-[11px] rounded-[3px]" style={{ background: bg }} />
          ))}
          More
        </div>
      </div>

      <dl className="flex min-w-40 flex-1 flex-wrap content-end gap-x-8 gap-y-3">
        <Stat label={`Total ${unit}`} value={formatNumber(total)} />
        <Stat label="Active days" value={formatNumber(shown.filter((c) => c.count).length)} note={`of ${shown.length}`} />
        <Stat label="Busiest day" value={total ? formatNumber(busiest.count) : "—"} note={total ? `on ${formatDay(busiest.date)}` : undefined} />
      </dl>
      <figcaption className="sr-only">{text}</figcaption>
      <p aria-live="polite" className="sr-only">
        {activeCell ? `${formatDayLong(activeCell.date)}: ${activeCell.count} ${unit}` : ""}
      </p>

      {activeCell && active && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover/95 px-2.5 py-1.5 font-mono text-[11px] whitespace-nowrap shadow-lg backdrop-blur-sm"
          style={{ left: active.left, top: active.top - 6 }}
        >
          <div className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{formatDayLong(activeCell.date)}</div>
          <div>
            <span className="text-[13px] font-semibold tabular-nums">{activeCell.count}</span>{" "}
            <span className="font-sans text-muted-foreground">{activeCell.count === 1 ? unit.replace(/s$/, "") : unit}</span>
          </div>
        </div>
      )}
    </figure>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-mono text-lg leading-tight font-semibold tabular-nums">
        {value}
        {note && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{note}</span>}
      </dd>
    </div>
  )
}
