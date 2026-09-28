import { Suspense } from "react"
import Link from "next/link"
import { ArrowUpRight, FolderPlus, PackagePlus } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { IssueDialog } from "@/components/issue-dialog"
import { ComponentFormDialog } from "@/components/inventory/component-form-dialog"
import { ProjectFormDialog } from "@/components/projects/project-form"
import { APP_TIME_ZONE, toDateInput, todayNoonUTC } from "@/lib/dates"
import { getSelectOptions } from "@/lib/queries"
import { checkoutSeries, dueSoon, projectProgress, statusHeadline, teamSnapshot } from "./data"
import { Clock } from "./stage"
import { daysBetween, relDays } from "./util"

const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE })
const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP_TIME_ZONE })

/** Same buckets as the intro's welcome note, so the greeting carries straight on from it. */
function greeting(now: Date) {
  const h = Number(hourFmt.format(now))
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening"
}

/** Greeting, today's date, the plain-language status sentence, admin quick actions and the live readout strip. */
export function Hero({ admin }: { admin: boolean }) {
  const now = new Date()
  return (
    <section
      data-panel
      style={{ "--i": 0 } as React.CSSProperties}
      aria-labelledby="dash-greeting"
      className="grid gap-x-8 gap-y-4 xl:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0">
        <p className="eyebrow mb-3 flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-[3px] rounded-[1px] bg-brand" />
          <time dateTime={toDateInput(todayNoonUTC())}>{dateFmt.format(now).replace(/, (\d{4})$/, " $1")}</time>
        </p>
        <h1 id="dash-greeting" className="font-display text-[2rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.75rem]">
          {greeting(now)}.
        </h1>
      </div>
      {admin && (
        <div className="order-3 flex flex-wrap gap-2 xl:order-none xl:self-end xl:justify-end">
          <Suspense fallback={<QuickActionButtons />}>
            <QuickActions />
          </Suspense>
        </div>
      )}
      <div className="xl:col-span-2">
        <Suspense fallback={<Skeleton className="h-7 w-full max-w-2xl" />}>
          <StatusSentence />
        </Suspense>
      </div>
      <div className="@container order-4 mt-1 min-w-0 xl:col-span-2">
        <Suspense fallback={<Skeleton className="h-10 rounded-lg" />}>
          <ReadoutStrip />
        </Suspense>
      </div>
    </section>
  )
}

const word = (n: number, w: string) => (n === 1 ? w : `${w}s`)

type Fragment = { href: string; count: number; label: string; led: string }

/** "3 returns overdue · 3 parts low on stock · 2 projects moving · 4 tasks due this week" — each part a link. */
async function StatusSentence() {
  const h = await statusHeadline()
  const parts: Fragment[] = [
    h.overdue > 0 && { href: "/issuances?tab=overdue", count: h.overdue, label: `${word(h.overdue, "return")} overdue`, led: "bg-danger" },
    h.lowStock > 0 && {
      href: "/inventory?stock=low",
      count: h.lowStock,
      label: `${word(h.lowStock, "part")} low on stock${h.outOfStock ? ` (${h.outOfStock} out)` : ""}`,
      led: "bg-brand",
    },
    h.inProgress > 0 && { href: "/projects?status=IN_PROGRESS", count: h.inProgress, label: `${word(h.inProgress, "project")} moving`, led: "bg-foreground" },
    h.tasksDueThisWeek > 0 && { href: "/tasks?due=week", count: h.tasksDueThisWeek, label: `${word(h.tasksDueThisWeek, "task")} due this week`, led: "bg-foreground" },
    h.overdueTasks > 0 && { href: "/tasks?due=overdue", count: h.overdueTasks, label: `${word(h.overdueTasks, "task")} past due`, led: "ring-[1.5px] ring-foreground ring-inset" },
  ].filter((p): p is Fragment => Boolean(p))

  if (!parts.length) {
    return <p className="text-lg text-muted-foreground sm:text-xl">All clear on the bench — nothing overdue, stock is healthy and no tasks are due this week.</p>
  }
  return (
    <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-lg leading-snug font-medium sm:text-[1.3rem]">
      {parts.map((p, i) => (
        <Link
          key={p.href}
          href={p.href}
          className="inline-flex items-baseline gap-2 rounded-sm underline decoration-border decoration-1 underline-offset-[6px] transition-colors outline-none hover:decoration-brand focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden className={cn("size-2 shrink-0 -translate-y-px self-center rounded-full", p.led)} />
          {i > 0 && <span className="sr-only">, </span>}
          <span>
            <span className="tabular-nums">{p.count}</span> {p.label}
          </span>
        </Link>
      ))}
    </p>
  )
}

async function QuickActions() {
  const [options, teams] = await Promise.all([getSelectOptions(), teamSnapshot()])
  return <QuickActionButtons options={options} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
}

/** Without data (Suspense fallback) the same buttons render disabled, so nothing jumps. */
function QuickActionButtons({ options, teams }: { options?: Awaited<ReturnType<typeof getSelectOptions>>; teams?: { id: string; name: string }[] }) {
  const issue = (
    <Button variant="brand" disabled={!options}>
      <ArrowUpRight /> Issue component
    </Button>
  )
  const add = (
    <Button variant="outline">
      <PackagePlus /> Add component
    </Button>
  )
  const project = (
    <Button variant="outline" disabled={!teams}>
      <FolderPlus /> New project
    </Button>
  )
  return (
    <>
      {options ? <IssueDialog options={options} trigger={issue} /> : issue}
      <ComponentFormDialog trigger={add} />
      {teams ? <ProjectFormDialog teams={teams} trigger={project} /> : project}
    </>
  )
}

/** Calm "instrument readout" strip: live clock, today's flow, the next return due and the last progress update. */
async function ReadoutStrip() {
  const [series, due, projects] = await Promise.all([checkoutSeries(), dueSoon(), projectProgress()])
  const today = series.at(-1)
  const next = due.dueSoon[0]
  const last = projects
    .flatMap((p) => (p.series.length ? [{ project: p, point: p.series[p.series.length - 1] }] : []))
    .sort((a, b) => b.point.date.localeCompare(a.point.date))[0]
  const todayKey = toDateInput(todayNoonUTC())

  return (
    // Narrow: a 2-column grid (hairlines via gap-px on a border-coloured backing). Wide: one row of readouts.
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border font-mono text-xs @4xl:flex @4xl:gap-0 @4xl:bg-card/80 dark:@4xl:bg-card/60">
      <Cell label="Live">
        <span aria-hidden className="relative mr-0.5 inline-flex size-1.5 self-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/60 [animation-duration:2.4s]" />
          <span className="relative size-1.5 rounded-full bg-brand" />
        </span>
        <Clock /> <span className="text-muted-foreground">IST</span>
      </Cell>
      <Cell label="Today">
        {today ? (
          <>
            <b className="font-semibold">{today.issued}</b> out <Dot /> <b className="font-semibold">{today.returned}</b> back
          </>
        ) : (
          "—"
        )}
      </Cell>
      <Cell label="Next due" wide>
        {next ? (
          <Link href={`/members/${next.issuedTo.id}`} className="min-w-0 hover:underline @4xl:truncate">
            {next.component.name} ×{next.quantity} <Dot /> {next.issuedTo.name.split(" ")[0]} <Dot />{" "}
            <span className="text-brand-strong">{relDays(next.daysLeft)}</span>
          </Link>
        ) : (
          <span className="text-muted-foreground">nothing in the next 3 days</span>
        )}
      </Cell>
      <Cell label="Last update" wide>
        {last ? (
          <Link href={`/projects/${last.project.id}`} className="min-w-0 hover:underline @4xl:truncate">
            {last.project.title} → <b className="font-semibold">{last.point.percent}%</b> <Dot />{" "}
            {relDays(daysBetween(todayKey, last.point.date))}
          </Link>
        ) : (
          <span className="text-muted-foreground">no updates yet</span>
        )}
      </Cell>
    </dl>
  )
}

function Cell({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 bg-card px-3.5 py-2.5 @4xl:min-w-max @4xl:shrink-0 @4xl:border-r @4xl:border-border @4xl:bg-transparent @4xl:px-4 @4xl:last:min-w-0 @4xl:last:shrink @4xl:last:border-r-0",
        wide && "col-span-2"
      )}
    >
      <dt className="text-[10px] tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("flex min-w-0 items-center gap-1.5 tabular-nums @4xl:whitespace-nowrap", !wide && "whitespace-nowrap")}>{children}</dd>
    </div>
  )
}

const Dot = () => (
  <span aria-hidden className="text-muted-foreground/60">
    ·
  </span>
)
