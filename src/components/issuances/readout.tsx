import { Card, CardContent } from "@/components/ui/card"
import { Sparkline } from "@/components/charts"
import { cn } from "@/lib/utils"

/** Small instrument card: eyebrow label, big number, one line of context, optional sparkline. `alert` = overdue-type red. */
export function Readout({
  label,
  value,
  context,
  spark,
  summary,
  alert,
}: {
  label: string
  value: number
  context: string
  spark?: number[]
  /** Sparkline aria-label. */
  summary?: string
  alert?: boolean
}) {
  return (
    <Card size="sm" className={cn("relative", alert && "before:bg-danger before:absolute before:inset-y-0 before:left-0 before:w-0.5")}>
      <CardContent className="grid gap-1.5">
        <p className="eyebrow truncate">{label}</p>
        <div className="flex items-end justify-between gap-3">
          <p className={cn("font-display text-3xl leading-none font-bold tabular-nums", alert && "text-danger")}>{value}</p>
          {spark && <Sparkline data={spark} height={30} summary={summary} className="hidden max-w-28 flex-1 sm:block" />}
        </div>
        <p className="text-muted-foreground truncate text-xs">{context}</p>
      </CardContent>
    </Card>
  )
}
