import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getKpis } from "@/lib/analytics"
import { dueSoon, statusHeadline } from "./data"
import { CountUp } from "./stage"
import styles from "./kpi-card.module.css"

const PERIOD = 30
/** Four equal cards: 2 across on phones, 4 across from lg. */
export const KPI_GRID = "grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6"

type KpiDef = {
  href: string
  label: string
  unit: string
  value: number
  context: string
  tone: "green" | "orange" | "red" | "blue"
  danger?: boolean
}

/** Four plain cards of equal weight: the number, its unit and one line of context. */
export async function KpiCards({ from }: { from: number }) {
  const [k, due, h] = await Promise.all([getKpis(PERIOD), dueSoon(), statusHeadline()])
  const oldest = due.overdue[0]
  const cards: KpiDef[] = [
    { href: "/inventory", label: "Available", unit: "units", tone: "green", value: k.available.value, context: "working and on the shelf" },
    { href: "/issuances", label: "On loan", unit: "units", tone: "orange", value: k.issuedNow.value, context: `of ${k.totalUnits.value} units the club owns` },
    {
      href: "/issuances?tab=overdue",
      label: "Overdue",
      tone: "red",
      unit: k.overdue.value === 1 ? "return" : "returns",
      value: k.overdue.value,
      danger: true,
      context: oldest ? `oldest is ${-oldest.daysLeft}d late` : "everything is back on time",
    },
    { href: "/tasks", label: "Open tasks", unit: "tasks", tone: "blue", value: k.openTasks.value, context: `${h.tasksDueThisWeek} due this week` },
  ]
  return cards.map((c, n) => <KpiCard key={c.label} i={from + n} {...c} />)
}

function KpiCard({ i, href, label, unit, value, context, tone, danger }: KpiDef & { i: number }) {
  const alert = danger && value > 0
  return (
    <Link
      href={href}
      data-panel
      style={{ "--i": i } as React.CSSProperties}
      className="group/kpi min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card data-tone={tone} className={cn(styles.tile, "h-full [--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(7)]")}>
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-center gap-2">
            {alert && <span aria-hidden className="size-1.5 rounded-full bg-danger" />}
            <p className="eyebrow">{label}</p>
            <ArrowUpRight
              aria-hidden
              className={cn(styles.arrow, "ml-auto size-3.5 text-muted-foreground opacity-50")}
            />
          </div>
          <p className="flex items-baseline gap-1.5">
            <span className={cn(styles.num, "font-display text-5xl leading-none font-bold tracking-tight tabular-nums")}>
              <CountUp value={value} />
            </span>
            <span className="font-mono text-[13px] text-muted-foreground">{unit}</span>
          </p>
          <p className="text-[13px] text-muted-foreground">{context}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function KpiSkeletons({ from }: { from: number }) {
  return Array.from({ length: 4 }, (_, n) => (
    <div key={n} data-panel style={{ "--i": from + n } as React.CSSProperties} className="min-w-0">
      <Skeleton className="h-full min-h-36 rounded-xl" />
    </div>
  ))
}
