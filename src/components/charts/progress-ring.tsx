import type * as React from "react"
import { cn } from "cn"
import { CHART, mix } from "./shared"

const SIZES = {
  sm: { px: 40, stroke: 10, text: "text-[10px]", ticks: false },
  md: { px: 72, stroke: 8, text: "text-base", ticks: true },
  lg: { px: 120, stroke: 7, text: "text-[28px]", ticks: true },
} as const

/**
 * Radial gauge with a centred mono percentage and dial ticks (md/lg). Pure SVG, works in server components;
 * the arc sweeps in on first paint unless reduced motion.
 */
export function ProgressRing({
  value,
  size = "md",
  label = "Progress",
  children,
  className,
}: {
  /** 0–100 (clamped). */
  value: number
  size?: keyof typeof SIZES
  /** Accessible name, e.g. the project name. */
  label?: string
  /** Replaces the centred percentage. */
  children?: React.ReactNode
  className?: string
}) {
  const v = Math.round(Math.min(100, Math.max(0, value || 0)))
  const s = SIZES[size]
  const r = s.ticks ? 38 : 50 - s.stroke / 2
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: s.px, height: s.px }}
    >
      <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 size-full -rotate-90">
        {s.ticks &&
          Array.from({ length: 40 }, (_, i) => {
            const major = i % 10 === 0
            const a = (i / 40) * 2 * Math.PI
            const r1 = major ? 44 : 46
            return (
              <line
                key={i}
                // Rounded so server and browser maths agree (hydration).
                x1={(50 + r1 * Math.cos(a)).toFixed(2)}
                y1={(50 + r1 * Math.sin(a)).toFixed(2)}
                x2={(50 + 49 * Math.cos(a)).toFixed(2)}
                y2={(50 + 49 * Math.sin(a)).toFixed(2)}
                stroke={i / 40 < v / 100 ? CHART.brand : CHART.muted}
                strokeOpacity={i / 40 < v / 100 ? 0.9 : 0.35}
                strokeWidth={major ? 1.6 : 1}
              />
            )
          })}
        <circle cx="50" cy="50" r={r} fill="none" stroke={`var(--brand-soft, ${mix(CHART.brand, 16)})`} strokeWidth={s.stroke} />
        {v > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={CHART.brand}
            strokeWidth={s.stroke}
            strokeLinecap={v < 100 ? "round" : "butt"}
            pathLength={100}
            style={{ "--v": v } as React.CSSProperties}
            className="transition-[stroke-dasharray] duration-1000 ease-out [stroke-dasharray:var(--v)_100] starting:[stroke-dasharray:0_100] motion-reduce:transition-none"
          />
        )}
      </svg>
      <span className={cn("relative font-mono leading-none font-semibold tabular-nums", s.text)}>
        {children ?? (
          <>
            {v}
            <span className="text-[0.6em] font-medium text-muted-foreground">%</span>
          </>
        )}
      </span>
    </div>
  )
}
