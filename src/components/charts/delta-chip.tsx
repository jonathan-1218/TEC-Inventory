import { cn } from "cn"

/**
 * Change vs the previous period for KPI cards: "▲ 12% vs prev.".
 * Better = orange (brand-soft/brand-strong), worse = muted, or danger red when `danger` (overdue-type metrics only).
 */
export function DeltaChip({
  value,
  suffix = "%",
  label = "vs prev.",
  good = "up",
  danger = false,
  className,
}: {
  value: number
  /** Unit after the number, e.g. "%", " pts", "". */
  suffix?: string
  label?: string
  /** Which direction is good news. */
  good?: "up" | "down"
  /** Worse is shown in red (use for overdue counts only). */
  danger?: boolean
  className?: string
}) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat"
  const better = dir !== "flat" && dir === good
  const worse = dir !== "flat" && !better
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[13px] whitespace-nowrap tabular-nums", className)}>
      <span
        className={cn(
          "inline-flex h-5 items-center gap-1 rounded-sm px-1.5",
          better && "bg-brand-soft text-brand-strong",
          worse && (danger ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground"),
          dir === "flat" && "bg-muted text-muted-foreground"
        )}
      >
        <span aria-hidden className="text-[13px]">{dir === "up" ? "▲" : dir === "down" ? "▼" : "■"}</span>
        <span className="sr-only">{dir === "flat" ? "no change" : dir}</span>
        {Math.abs(value)}
        {suffix}
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </span>
  )
}
