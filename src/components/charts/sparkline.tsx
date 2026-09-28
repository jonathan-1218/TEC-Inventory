import { useId } from "react"
import { cn } from "cn"
import { CHART, mix } from "./shared"

/**
 * Tiny trend line for KPI cards: orange trace, soft gradient, glowing end dot. No axes.
 * Pure SVG (works in server components); sweeps in left→right on first paint unless reduced motion.
 */
export function Sparkline({
  data,
  height = 36,
  dot = true,
  color = CHART.brand,
  summary,
  className,
}: {
  /** Oldest → newest. */
  data: number[]
  height?: number
  /** Mark the latest point. */
  dot?: boolean
  color?: string
  /** aria-label, e.g. "Checkouts, last 14 days: 3 to 11, now 9". Generated when omitted. */
  summary?: string
  className?: string
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "")
  const pad = 3
  const values = data.length > 1 ? data : [data[0] ?? 0, data[0] ?? 0]
  const min = Math.min(...values)
  const max = Math.max(...values)
  // ponytail: min–max scaled like most sparklines; a flat series sits on the floor (zero) or mid-height.
  const y = (v: number) =>
    max === min ? (max === 0 ? height - pad : height / 2) : pad + (1 - (v - min) / (max - min)) * (height - 2 * pad)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, y(v)] as const)
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`).join(" ")
  const last = pts[pts.length - 1]

  return (
    <div
      role="img"
      aria-label={summary ?? `Trend of ${data.length} points, from ${data[0] ?? 0} to ${data.at(-1) ?? 0}, low ${min}, high ${max}`}
      className={cn("relative w-full", className)}
      style={{ height }}
    >
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        aria-hidden
        className="absolute inset-0 size-full overflow-visible transition-[clip-path] duration-1000 ease-out [clip-path:inset(-8px_-8px_-8px_-8px)] starting:[clip-path:inset(-8px_100%_-8px_-8px)] motion-reduce:transition-none"
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={`${line} L100 ${height} L0 ${height} Z`} fill={`url(#${id}-fill)`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 3px ${mix(color, 55)})` }}
        />
      </svg>
      {dot && (
        <span
          aria-hidden
          className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity delay-700 duration-300 starting:opacity-0 motion-reduce:transition-none"
          style={{
            left: "100%",
            top: `${(last[1] / height) * 100}%`,
            background: color,
            boxShadow: `0 0 0 2px ${CHART.surface}, 0 0 10px 1px ${mix(color, 70)}`,
          }}
        />
      )}
    </div>
  )
}
