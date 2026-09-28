// Read-only dashboard panels (server components). Each one fetches its own data so it can stream on its own.
import Link from "next/link"
import { cn } from "cn"
import { ProjectStatusBadge } from "@/components/badges"
import { ActivityHeatmap, ProgressRing, StackedBars, formatDay } from "@/components/charts"
import { ACTIVE_STATUSES, getActivityHeatmap, getInventoryHealth, type ProjectProgress } from "@/lib/analytics"
import { toDateInput, todayNoonUTC } from "@/lib/dates"
import { STATUS_LABELS } from "@/lib/labels"
import { projectProgress, teamSnapshot } from "./data"
import { daysBetween, plural } from "./util"

export async function InventoryHealthBody() {
  const rows = await getInventoryHealth()
  const total = rows.reduce((n, r) => n + r.total, 0)
  const available = rows.reduce((n, r) => n + r.available, 0)
  if (!rows.length) return <p className="py-8 text-center font-mono text-xs text-muted-foreground">No components yet</p>
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2">
        <span className="font-display text-3xl leading-none font-bold tabular-nums">{Math.round((available / total) * 100)}%</span>
        <span className="text-sm text-muted-foreground">
          of {total} units are on the shelf, ready to issue
        </span>
      </p>
      <StackedBars
        data={rows.map((r) => ({ label: r.label, available: r.available, issued: r.issued, damaged: r.damaged, underRepair: r.underRepair }))}
      />
    </div>
  )
}

// ---------- Projects in motion ----------

export async function ProjectsBody() {
  const all = await projectProgress()
  const active = all.filter((p) => ACTIVE_STATUSES.includes(p.status))
  const today = toDateInput(todayNoonUTC())
  const rest = (["ON_HOLD", "COMPLETED"] as const)
    .map((s) => [s, all.filter((p) => p.status === s).length] as const)
    .filter(([, n]) => n > 0)

  return (
    <div className="@container flex flex-col">
      {active.length ? (
        <ul className="-mt-2 divide-y divide-border">
          {active.map((p) => (
            <ProjectRow key={p.id} p={p} today={today} />
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center font-mono text-xs text-muted-foreground">No project is being planned or built right now</p>
      )}
      {rest.length > 0 && (
        <p className="mt-2 border-t border-dashed border-border pt-3 font-mono text-[11px] text-muted-foreground">
          Also {rest.map(([s, n]) => `${n} ${STATUS_LABELS[s].toLowerCase()}`).join(" · ")}
        </p>
      )}
    </div>
  )
}

function ProjectRow({ p, today }: { p: ProjectProgress; today: string }) {
  const left = p.targetDate ? daysBetween(today, p.targetDate) : 0
  const late = left < 0
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 py-3.5 @min-[34rem]:grid-cols-[auto_minmax(0,1fr)_7.5rem_5.5rem]">
      <ProgressRing value={p.progressPercent} size="sm" label={`${p.title}: ${p.progressPercent}% done`} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/projects/${p.id}`} className="line-clamp-2 font-medium outline-none hover:text-brand-strong focus-visible:underline">
            {p.title}
          </Link>
          <ProjectStatusBadge status={p.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground @min-[34rem]:gap-x-2">
          {p.team ? (
            <Link href={`/teams/${p.team.id}`} className="hover:text-foreground hover:underline">
              {p.team.name}
            </Link>
          ) : (
            <span>No team</span>
          )}
          <Sep />
          <TaskMeter done={p.tasks.done} total={p.tasks.total} />
          {p.tasks.overdue > 0 && (
            <>
              <Sep />
              <span className="text-danger">{plural(p.tasks.overdue, "task")} late</span>
            </>
          )}
        </p>
      </div>
      <ProgressTrace project={p} today={today} className="hidden @min-[34rem]:block" />
      <div className="text-right font-mono text-xs leading-tight tabular-nums">
        {p.targetDate ? (
          <>
            <p>{formatDay(toDateInput(p.targetDate))}</p>
            <p className={cn("mt-0.5 text-[11px]", late ? "font-medium text-danger" : "text-muted-foreground")}>
              {late ? `${-left}d late` : left === 0 ? "due today" : `${left}d left`}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">no target</p>
        )}
      </div>
    </li>
  )
}

/** Dot between meta items; dropped in narrow panels where the items wrap and a dot would dangle at a line end. */
const Sep = () => (
  <span aria-hidden className="@max-[34rem]:hidden">
    ·
  </span>
)

function TaskMeter({ done, total }: { done: number; total: number }) {
  if (!total) return <span>no tasks yet</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="relative h-1 w-10 overflow-hidden rounded-full bg-muted">
        <span className="absolute inset-y-0 left-0 rounded-full bg-foreground/70" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="font-mono tabular-nums">
        {done}/{total}
      </span>{" "}
      tasks
    </span>
  )
}

/**
 * Tiny step line of progress over real time (start → today, 0–100%), one step per progress update.
 * Evenly spaced sparklines would hide the gaps between updates, so this one is time-scaled.
 */
function ProgressTrace({ project: p, today, className }: { project: ProjectProgress; today: string; className?: string }) {
  const W = 120
  const H = 34
  if (!p.series.length) return <span className={cn("font-mono text-[10px] text-muted-foreground", className)}>no updates yet</span>
  const first = p.series[0].date
  const start = p.startDate && toDateInput(p.startDate) < first ? toDateInput(p.startDate) : first
  const span = Math.max(1, daysBetween(start, today))
  const x = (d: string) => ((daysBetween(start, d) / span) * W).toFixed(1)
  const y = (pct: number) => (H - 2 - (pct / 100) * (H - 4)).toFixed(1)
  const line = `M0 ${y(0)}` + p.series.map((pt) => ` H${x(pt.date)} V${y(pt.percent)}`).join("") + ` H${W}`
  const last = p.series[p.series.length - 1]
  const live = p.status === "IN_PROGRESS"
  const color = live ? "var(--brand)" : "var(--muted-foreground)"
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={`${p.title} progress over time: ${p.series.map((pt) => `${pt.percent}% on ${formatDay(pt.date)}`).join(", ")}`}
      className={cn("overflow-visible", className)}
    >
      {[50, 100].map((g) => (
        <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray="2 3" />
      ))}
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--border)" />
      {live && <path d={`${line} V${H - 2} H0 Z`} fill="color-mix(in oklab, var(--brand) 12%, transparent)" />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        pathLength={1}
        className="transition-[stroke-dashoffset] duration-1000 ease-out [stroke-dasharray:1] [stroke-dashoffset:0] starting:[stroke-dashoffset:1] motion-reduce:transition-none"
      />
      <circle cx={W} cy={y(last.percent)} r="2.5" fill={color} stroke="var(--card)" strokeWidth="1.5" />
    </svg>
  )
}

// ---------- Teams ----------

export async function TeamsBody() {
  const [teams, projects] = await Promise.all([teamSnapshot(), projectProgress()])
  if (!teams.length) return <p className="py-8 text-center font-mono text-xs text-muted-foreground">No teams yet</p>
  return (
    <ul className="-mt-1 flex flex-1 flex-col divide-y divide-border">
      {teams.map((t) => (
        <li key={t.id} className="flex flex-1 flex-col justify-center py-3 first:pt-1 last:pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <Link href={`/teams/${t.id}`} className="truncate font-medium outline-none hover:text-brand-strong focus-visible:underline">
              {t.name}
            </Link>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {t.avgProgress === null ? (
                "no open projects"
              ) : (
                <>
                  <b className="text-sm font-semibold text-foreground">{t.avgProgress}%</b> avg
                </>
              )}
            </span>
          </div>
          <TeamProjects projects={projects.filter((p) => p.team?.id === t.id && ACTIVE_STATUSES.includes(p.status))} />
          <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${t.avgProgress ?? 0}%` }} />
          </div>
          <dl className="mt-2.5 grid grid-cols-4 gap-2">
            <Readout label="Members" value={t.members} />
            <Readout label="Active" value={t.activeProjects} />
            <Readout label="Tasks" value={t.openTasks} />
            <Readout label="On loan" value={t.unitsOnLoan} />
          </dl>
        </li>
      ))}
    </ul>
  )
}

/** What the team is building right now, as links. */
function TeamProjects({ projects }: { projects: ProjectProgress[] }) {
  return (
    <p className="mt-0.5 truncate text-xs text-muted-foreground">
      {projects.length
        ? projects.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <Link href={`/projects/${p.id}`} className="hover:text-foreground hover:underline">
                {p.title}
              </Link>
            </span>
          ))
        : "Nothing active"}
    </p>
  )
}

function Readout({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-0.5">
      <dt className="truncate text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("font-mono text-sm font-semibold tabular-nums", value === 0 && "text-muted-foreground")}>{value}</dd>
    </div>
  )
}

// ---------- Activity heatmap ----------

export async function HeatmapBody() {
  const days = await getActivityHeatmap(26)
  // When the panel is wide enough, the kit's stats row stands as a readout column beside the grid instead of wrapping below.
  return (
    <div className="@container">
      <ActivityHeatmap
        data={days.map((d) => ({ date: d.date, count: d.total }))}
        end={days.at(-1)?.date}
        unit="actions"
        className="@min-[42rem]:flex-nowrap @min-[42rem]:gap-x-6 @min-[42rem]:[&>dl]:min-w-0 @min-[42rem]:[&>dl]:flex-none @min-[42rem]:[&>dl]:flex-col @min-[42rem]:[&>dl]:gap-y-4"
      />
    </div>
  )
}
