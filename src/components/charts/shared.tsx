// Shared bits for the chart kit. No hooks and no "use client": safe in server and client components.
import type * as React from "react"
import { parseDateInput } from "@/lib/dates"

// Colours only come from theme tokens; the hex values are fallbacks for when a token is missing.
export const CHART = {
  brand: "var(--chart-1, var(--brand, #E99704))",
  ink: "var(--chart-2, var(--foreground, #0B0B0B))",
  tint: "var(--chart-3, #F4C46A)",
  grey: "var(--chart-4, #A8A29E)",
  greyDark: "var(--chart-5, #57534E)",
  muted: "var(--muted-foreground, #78716C)",
  grid: "var(--border, #E7E5E4)",
  surface: "var(--card, #FFFFFF)",
} as const

/** Series colours in fixed order (never cycled by rank). */
export const SERIES_COLORS = [CHART.brand, CHART.ink, CHART.grey, CHART.tint, CHART.greyDark] as const

/** Line dash per series slot, so lines never differ by colour alone. */
export const SERIES_DASH = [undefined, "5 4", "1.5 3.5", "8 3 1.5 3", "3 3"] as const

/** `color` at `pct`% over transparent — tints without new tokens. */
export const mix = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`

export type StackedSeries = { key: string; label: string; color?: string; hatch?: boolean }
export type StackedRow = { label: string } & Record<string, string | number>

/** Stock breakdown per category, matching DESIGN.md: available = ink, issued = orange, damaged = hatched, repair = tint. */
export const INVENTORY_SERIES: StackedSeries[] = [
  { key: "available", label: "Available", color: mix(CHART.ink, 82) },
  { key: "issued", label: "Issued", color: CHART.brand },
  { key: "damaged", label: "Damaged", color: CHART.ink, hatch: true },
  { key: "underRepair", label: "Under repair", color: CHART.tint },
]

/** 0-based axis ticks on a 1/2/5 step, e.g. max 13 -> [0, 5, 10, 15]. Small maxima get 0-4 so a flat zero line sits low. */
export function niceTicks(max: number, count = 4): number[] {
  const raw = Math.max(max, 4) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = (mag >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]).map((m) => m * mag).find((st) => st >= raw) ?? raw
  return Array.from({ length: Math.ceil(Math.max(max, 4) / step) + 1 }, (_, i) => i * step)
}

export const RANGES = ["7d", "30d", "90d"] as const
export type Range = (typeof RANGES)[number]

/** For server pages: `?range=` value -> a valid range (default 30d) and its length in days. */
export function parseRange(value: unknown, fallback: Range = "30d"): { range: Range; days: number } {
  const range = RANGES.includes(value as Range) ? (value as Range) : fallback
  return { range, days: Number.parseInt(range) }
}

const numberFmt = new Intl.NumberFormat("en-IN")
export const formatNumber = (n: number) => numberFmt.format(n)

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
const longDayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** "2026-09-12" -> "12 Sept". Anything that is not a YYYY-MM-DD string is returned as-is. */
export function formatDay(value: unknown): string {
  return typeof value === "string" && ISO_DAY.test(value) ? dayFmt.format(parseDateInput(value)) : String(value ?? "")
}

/** "2026-09-12" -> "Sat, 12 Sept 2026" (tooltip / table header). */
export function formatDayLong(value: unknown): string {
  return typeof value === "string" && ISO_DAY.test(value) ? longDayFmt.format(parseDateInput(value)) : String(value ?? "")
}

/** Visually hidden data table: the screen-reader twin of a chart. */
export function SrTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: React.ReactNode[][]
}) {
  return (
    // Wrapped: tables ignore sr-only's 1px width and would widen the page.
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

/** Short line key used in legends and the readout (dashed when the series is dashed). */
export function LineKey({ color, dash, width = 14 }: { color: string; dash?: string; width?: number }) {
  return (
    <svg width={width} height="6" aria-hidden className="shrink-0 overflow-visible">
      <line x1="0" x2={width} y1="3" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  )
}

/** Square key for bars; `hatch` draws diagonal stripes so the meaning isn't colour-only. */
export function SwatchKey({ color, hatch }: { color: string; hatch?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-[2px]"
      style={
        hatch
          ? { backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 1.5px, transparent 1.5px 4px)`, boxShadow: `inset 0 0 0 1px ${mix(color, 60)}` }
          : { background: color }
      }
    />
  )
}

export type SeriesMeta = {
  key: string
  label: string
  color: string
  /** How the series is keyed in legends/readouts: a line (default), a box (bars) or a hatched box. */
  mark?: "line" | "box" | "hatch"
  dash?: string
}

export function SeriesKey({ s, width }: { s: SeriesMeta; width?: number }) {
  return s.mark === "box" || s.mark === "hatch" ? (
    <SwatchKey color={s.color} hatch={s.mark === "hatch"} />
  ) : (
    <LineKey color={s.color} dash={s.dash} width={width} />
  )
}

/**
 * The "instrument readout" tooltip body. Pass as `content` of a recharts <Tooltip>.
 * Values lead (bright, mono), series names follow (muted).
 */
export function Readout({
  active,
  payload,
  label,
  series,
  formatLabel = formatDayLong,
  formatValue = formatNumber,
  total,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>
  label?: unknown
  series: SeriesMeta[]
  formatLabel?: (label: unknown) => string
  formatValue?: (n: number) => string
  total?: boolean
}) {
  if (!active || !payload?.length) return null
  const rows = series
    .map((s) => ({ s, v: payload.find((p) => p.dataKey === s.key)?.value }))
    .filter((r): r is { s: SeriesMeta; v: number } => typeof r.v === "number")
  return (
    <div className="pointer-events-none min-w-40 rounded-md border border-border bg-popover/95 px-3 py-2 font-mono text-[13px] text-popover-foreground shadow-lg backdrop-blur-sm">
      <div className="mb-1.5 border-b border-dashed border-border pb-1.5 text-[13px] tracking-[0.12em] text-muted-foreground uppercase">
        {formatLabel(label)}
      </div>
      <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-2.5 gap-y-1">
        {rows.map(({ s, v }) => (
          <div key={s.key} className="contents">
            <SeriesKey s={s} width={12} />
            <span className="text-right text-[13px] font-semibold text-foreground tabular-nums">{formatValue(v)}</span>
            <span className="truncate font-sans text-muted-foreground">{s.label}</span>
          </div>
        ))}
        {total && rows.length > 1 && (
          <div className="contents">
            <span />
            <span className="border-t border-border pt-1 text-right text-[13px] font-semibold text-foreground tabular-nums">
              {formatValue(rows.reduce((sum, r) => sum + r.v, 0))}
            </span>
            <span className="border-t border-border pt-1 font-sans text-muted-foreground">Total</span>
          </div>
        )}
      </div>
    </div>
  )
}
