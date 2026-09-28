import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CHART, DeltaChip, Sparkline } from "@/components/charts"
import { getKpis, type Kpi } from "@/lib/analytics"
import { dueSoon, statusHeadline } from "./data"
import { CountUp } from "./stage"

const PERIOD = 30
/** Grid placement shared by the cards and their skeletons: the hero KPI is wide (and tall at lg). */
export const KPI_GRID = "grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6"
const HERO = "col-span-2 lg:row-span-2 xl:row-span-1"

type KpiDef = {
  href: string
  label: string
  unit: string
  kpi: Kpi
  good: "up" | "down"
  deltaLabel?: string
  context?: string
  danger?: boolean
}

/** Five instrument cards: one orange hero (units on loan) and four ink readouts, each with a 30-day trace. */
export async function KpiCards({ from }: { from: number }) {
  const [k, due, h] = await Promise.all([getKpis(PERIOD), dueSoon(), statusHeadline()])
  const oldest = due.overdue[0]
  const cards: KpiDef[] = [
    { href: "/issuances", label: "On loan", unit: "units", kpi: k.issuedNow, good: "up", context: `out with members, of ${k.totalUnits.value} units the club owns` },
    { href: "/inventory", label: "Available", unit: "units", kpi: k.available, good: "up", context: "working and on the shelf" },
    {
      href: "/issuances?tab=overdue",
      label: "Overdue",
      unit: k.overdue.value === 1 ? "return" : "returns",
      kpi: k.overdue,
      good: "down",
      danger: true,
      context: oldest ? `oldest is ${-oldest.daysLeft}d late` : "everything is back on time",
    },
    { href: "/tasks", label: "Open tasks", unit: "tasks", kpi: k.openTasks, good: "down", context: `${h.tasksDueThisWeek} due this week` },
    {
      href: "/members",
      label: "Members",
      unit: "active",
      kpi: k.activeMembers,
      good: "up",
      deltaLabel: `vs prev. ${PERIOD}d`,
      context: `borrowed, returned or built something in ${PERIOD} days`,
    },
  ]
  return cards.map((c, n) => <KpiCard key={c.label} i={from + n} hero={n === 0} {...c} />)
}

function KpiCard({ i, hero, href, label, unit, kpi, good, deltaLabel = `vs ${PERIOD}d ago`, context, danger }: KpiDef & { i: number; hero: boolean }) {
  const values = kpi.series.map((p) => p.value)
  const alert = danger && kpi.value > 0
  return (
    <Link
      href={href}
      data-panel
      style={{ "--i": i } as React.CSSProperties}
      className={cn("group/kpi min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", hero && HERO)}
    >
      <Card size="sm" className="relative h-full transition-colors duration-150 group-hover/kpi:bg-muted/40 dark:group-hover/kpi:bg-muted/25">
        {hero && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-[2px] bg-brand" />}
        <CardContent className="flex h-full flex-col gap-2.5">
          <div className="flex items-center gap-2">
            {alert && <span aria-hidden className="size-1.5 rounded-full bg-danger" />}
            <p className="eyebrow">{label}</p>
            <ArrowUpRight
              aria-hidden
              className="ml-auto size-3.5 text-muted-foreground opacity-40 transition-opacity group-hover/kpi:opacity-100 group-focus-visible/kpi:opacity-100"
            />
          </div>
          <p className="flex items-baseline gap-1.5">
            <span className={cn("font-display leading-none font-bold tracking-tight tabular-nums", hero ? "text-5xl" : "text-[2rem]")}>
              <CountUp value={kpi.value} />
            </span>
            <span className="font-mono text-xs text-muted-foreground">{unit}</span>
          </p>
          {context && <p className="-mt-0.5 text-xs text-muted-foreground">{context}</p>}
          <div className={cn("mt-auto flex flex-col gap-2.5 pt-1", hero && "lg:gap-3")}>
            <Sparkline
              data={values}
              height={hero ? 52 : 30}
              color={hero ? CHART.brand : CHART.muted}
              dot={hero}
              summary={`${label}, last ${values.length} days: from ${values[0]} to ${values.at(-1)}, low ${Math.min(...values)}, high ${Math.max(...values)}`}
            />
            {kpi.delta !== null && <DeltaChip value={kpi.delta} suffix="" label={deltaLabel} good={good} danger={danger} />}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function KpiSkeletons({ from }: { from: number }) {
  return Array.from({ length: 5 }, (_, n) => (
    <div key={n} data-panel style={{ "--i": from + n } as React.CSSProperties} className={cn("min-w-0", n === 0 && HERO)}>
      <Skeleton className={cn("h-full rounded-xl", n === 0 ? "min-h-44" : "min-h-40")} />
    </div>
  ))
}
