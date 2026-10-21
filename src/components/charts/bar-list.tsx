import type { CSSProperties } from "react"
import Link from "next/link"
import { cn } from "cn"
import { CHART, formatNumber, mix } from "./shared"

export type BarListItem = { label: string; value: number; href?: string; hint?: string }

/**
 * Ranked horizontal bars (top borrowers, most-issued parts…). Sorted by value, largest first.
 * An ordered list, so it reads fine without the bars; works in server components.
 */
export function BarList({
  items,
  limit,
  formatValue = formatNumber,
  summary,
  className,
}: {
  items: BarListItem[]
  /** Show only the top N. */
  limit?: number
  formatValue?: (n: number) => string
  /** aria-label for the list, e.g. "Top borrowers by checkouts, last 90 days". */
  summary?: string
  className?: string
}) {
  const rows = [...items].sort((a, b) => b.value - a.value).slice(0, limit)
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="py-6 text-center font-mono text-[13px] text-muted-foreground">Nothing to rank yet</p>

  return (
    <ol aria-label={summary} className={cn("flex flex-col gap-1.5", className)}>
      {rows.map((r, i) => {
        const body = (
          <>
            <span className="w-5 shrink-0 font-mono text-[13px] text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className="relative flex h-7 min-w-0 flex-1 items-center">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-r-[4px] w-(--w) border-l-2 bg-(--bar) transition-[width,background-color] duration-700 ease-out group-hover/bar:bg-(--bar-hover) starting:w-0 motion-reduce:transition-none"
                style={
                  {
                    "--w": `${Math.max(1.5, (r.value / max) * 100)}%`,
                    "--bar": mix(CHART.brand, i === 0 ? 30 : 18),
                    borderColor: CHART.brand,
                    "--bar-hover": mix(CHART.brand, 38),
                  } as CSSProperties
                }
              />
              <span className="relative truncate px-2.5 text-[13px]">
                {r.label}
                {r.hint && <span className="ml-1.5 text-[13px] text-muted-foreground">{r.hint}</span>}
              </span>
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums">{formatValue(r.value)}</span>
          </>
        )
        const rowClass = "group/bar flex items-center gap-2 rounded-md"
        return (
          <li key={`${r.label}-${i}`}>
            {r.href ? (
              <Link href={r.href} className={cn(rowClass, "outline-none focus-visible:ring-2 focus-visible:ring-ring [&:hover_.truncate]:underline [&:hover_.truncate]:underline-offset-2")}>
                {body}
              </Link>
            ) : (
              <div className={rowClass}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
