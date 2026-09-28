import { cn } from "@/lib/utils"

type Stock = {
  quantityAvailable: number
  quantityIssued: number
  quantityDamaged: number
  quantityUnderRepair: number
  quantityTotal: number
}

/** Segment order, labels and fills — matches the chart kit's INVENTORY_SERIES (DESIGN.md). */
export const STOCK_SEGMENTS = [
  { key: "quantityAvailable", label: "Available", fill: "bg-foreground/80" },
  { key: "quantityIssued", label: "Issued", fill: "bg-brand" },
  { key: "quantityDamaged", label: "Damaged", fill: "bg-foreground/10 hatch [--hatch:var(--foreground)]" },
  { key: "quantityUnderRepair", label: "Under repair", fill: "bg-chart-3" },
] as const

/** Swatch for legends, same fill as the bar segment. */
export function StockSwatch({ index, className }: { index: number; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-[2px]", STOCK_SEGMENTS[index].fill, className)} />
}

/**
 * Horizontal stock bar: available · issued · damaged · under repair, as shares of the total.
 * `threshold` draws a tick at the low-stock level (units counted from the left, like "available").
 */
export function StockMeter({
  stock,
  threshold,
  className,
}: {
  stock: Stock
  threshold?: number
  className?: string
}) {
  const total = stock.quantityTotal
  const label = STOCK_SEGMENTS.map((s) => `${stock[s.key]} ${s.label.toLowerCase()}`).join(", ") + ` of ${total}`
  return (
    <div role="img" aria-label={label} className={cn("bg-muted relative flex h-1.5 overflow-hidden rounded-[2px]", className)}>
      {total > 0 &&
        STOCK_SEGMENTS.map(
          (s) =>
            stock[s.key] > 0 && (
              <span
                key={s.key}
                className={cn("h-full border-card not-last:border-r", s.fill)}
                style={{ width: `${(stock[s.key] / total) * 100}%` }}
              />
            )
        )}
      {threshold != null && total > 0 && threshold < total && (
        <span
          aria-hidden
          className="bg-brand-strong absolute inset-y-0 w-0.5"
          style={{ left: `calc(${(threshold / total) * 100}% - 1px)` }}
        />
      )}
    </div>
  )
}
