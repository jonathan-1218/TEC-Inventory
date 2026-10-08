import { CircleCheck, TriangleAlert } from "lucide-react"
import { formatDate } from "@/lib/dates"
import type { GoalStatus } from "@/lib/goals"
import { cn } from "@/lib/utils"

/** Goal vs actual for one project: a warning when behind pace or past the date, a quiet line when on track. */
export function GoalBanner({ status, progress }: { status: GoalStatus; progress: number }) {
  const { behind, missed } = status
  const source = status.source === "club" ? "Club goal" : "Goal"
  return (
    <div
      role={behind ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        behind ? "border-danger/40 bg-danger-soft" : "bg-card"
      )}
    >
      {behind ? <TriangleAlert className="text-danger mt-0.5 size-4 shrink-0" /> : <CircleCheck className="text-brand mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0">
        <p className="font-medium">
          {missed ? "Goal missed" : behind ? "Behind goal" : "On track"} · {source}: {status.percent}% by {formatDate(status.date)}
        </p>
        <p className="text-muted-foreground text-xs">
          {missed
            ? `The date has passed at ${progress}%. Post an update or ask an admin to set a new goal.`
            : `At ${progress}% — about ${status.expected}% was expected by today${behind ? `, ${status.behindBy} points behind.` : "."}`}
        </p>
      </div>
    </div>
  )
}
