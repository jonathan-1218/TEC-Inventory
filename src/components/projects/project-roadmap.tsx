"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import type { ProjectStatus } from "@prisma/client"
import { TriangleAlert } from "lucide-react"
import { ProjectStatusBadge } from "@/components/badges"
import type { ProjectCardData } from "@/components/projects/project-list"
import { formatDate, parseDateInput } from "@/lib/dates"
import { cn } from "@/lib/utils"

const DAY = 86_400_000
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12))
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12))
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" })

const BAR: Record<ProjectStatus, { bar: string; fill: string }> = {
  PLANNING: { bar: "border-border bg-card", fill: "bg-brand/60" },
  IN_PROGRESS: { bar: "border-brand/70 bg-brand-soft", fill: "bg-brand" },
  ON_HOLD: { bar: "hatch border-brand/40 [--hatch:color-mix(in_oklab,var(--brand)_22%,transparent)]", fill: "bg-brand/50" },
  COMPLETED: { bar: "border-foreground bg-foreground/15", fill: "bg-foreground" },
  DROPPED: { bar: "border-border bg-muted", fill: "bg-muted-foreground/40" },
}

/**
 * Start → target bars across months with a today line. Progress fills each bar; a target in the past
 * (project still open) gets a dashed red overrun to today. Scrolls sideways on phones.
 */
export function ProjectRoadmap({ projects, today }: { projects: ProjectCardData[]; today: string }) {
  const now = parseDateInput(today)
  const scroller = useRef<HTMLDivElement>(null)
  const todayLine = useRef<HTMLDivElement>(null)
  // On narrow screens start scrolled so today sits just right of centre (the label column is sticky).
  useEffect(() => {
    const box = scroller.current
    const line = todayLine.current
    if (!box || !line || box.scrollWidth <= box.clientWidth) return
    const x = line.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft // idempotent
    box.scrollLeft = x - box.clientWidth * 0.6
  }, [])
  const dated = projects.filter((p) => p.startDate || p.targetDate)
  const undated = projects.filter((p) => !p.startDate && !p.targetDate)

  const times = dated.flatMap((p) => [p.startDate, p.targetDate]).filter((d): d is Date => !!d)
  const from = monthStart(new Date(Math.min(now.getTime(), ...times.map((d) => new Date(d).getTime()))))
  const to = addMonths(new Date(Math.max(now.getTime(), ...times.map((d) => new Date(d).getTime()))), 1)
  const span = to.getTime() - from.getTime()
  const pct = (d: Date | string) => ((new Date(d).getTime() - from.getTime()) / span) * 100
  const months: Date[] = []
  for (let m = from; m < to; m = addMonths(m, 1)) months.push(m)

  return (
    <div className="grid gap-4">
      <div className="bg-card overflow-hidden rounded-xl border">
        <div ref={scroller} className="overflow-x-auto">
          <div className="relative min-w-[46rem]">
            {/* Month grid + today line, over the timeline column only. */}
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 left-40 sm:left-56">
              {months.map((m) => (
                <div
                  key={m.getTime()}
                  className="border-border/70 absolute inset-y-0 border-l border-dashed"
                  style={{ left: `${pct(m)}%` }}
                >
                  <span className="eyebrow absolute top-2 left-2 text-[10px] whitespace-nowrap">
                    {MONTH.format(m)}
                    {m.getUTCMonth() === 0 || m.getTime() === from.getTime() ? ` ${m.getUTCFullYear()}` : ""}
                  </span>
                </div>
              ))}
              <div ref={todayLine} className="bg-brand absolute inset-y-0 z-10 w-px" style={{ left: `${pct(now)}%` }}>
                <span className="bg-brand text-brand-foreground absolute top-6 -translate-x-1/2 rounded-sm px-1 font-mono text-[10px] font-semibold tracking-wider uppercase">
                  Today
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[10rem_1fr] border-b sm:grid-cols-[14rem_1fr]">
              <div className="bg-card eyebrow sticky left-0 z-20 border-r px-3 py-3 sm:px-4">Project</div>
              <div className="h-12" />
            </div>
            <ol>
              {dated.map((p) => (
                <RoadmapRow key={p.id} project={p} pct={pct} today={now} />
              ))}
            </ol>
          </div>
        </div>
        <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
          Bars run from start to target date; the fill is progress. A dashed red tail means the target has passed.
        </p>
      </div>

      {undated.length > 0 && (
        <div className="grid gap-2">
          <p className="eyebrow">No dates set</p>
          <ul className="flex flex-wrap gap-2">
            {undated.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="bg-card hover:border-foreground/25 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
                >
                  {p.title} <ProjectStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function RoadmapRow({
  project: p,
  pct,
  today,
}: {
  project: ProjectCardData
  pct: (d: Date | string) => number
  today: Date
}) {
  const start = p.startDate ?? p.targetDate!
  const end = p.targetDate ?? p.startDate!
  const left = pct(start)
  const width = Math.max(pct(end) - left, 0.8)
  const late = p.targetOverdue && p.targetDate
  const lateDays = late ? Math.round((today.getTime() - new Date(p.targetDate!).getTime()) / DAY) : 0
  const s = BAR[p.status]

  return (
    <li className="group hover:bg-muted/40 grid grid-cols-[10rem_1fr] border-b last:border-b-0 sm:grid-cols-[14rem_1fr]">
      <div className="bg-card group-hover:bg-muted sticky left-0 z-20 grid min-w-0 gap-0.5 border-r px-3 py-2.5 sm:px-4">
        <Link
          href={`/projects/${p.id}`}
          className={cn("hover:text-brand-strong truncate text-sm font-medium", p.status === "DROPPED" && "line-through")}
        >
          {p.title}
        </Link>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="text-foreground font-mono tabular-nums">{p.progressPercent}%</span>·
          {late ? (
            <span className="text-danger flex items-center gap-1 font-medium">
              <TriangleAlert aria-hidden className="size-3" /> {lateDays}d past target
            </span>
          ) : (
            <span className="truncate">
              {formatDate(p.startDate)} → {formatDate(p.targetDate)}
            </span>
          )}
        </span>
      </div>
      <div className="relative" aria-hidden title={`${p.title}: ${formatDate(p.startDate)} → ${formatDate(p.targetDate)}, ${p.progressPercent}%`}>
        {late && (
          <div
            className="border-danger absolute top-1/2 border-t-2 border-dashed"
            style={{ left: `${pct(p.targetDate!)}%`, width: `${pct(today) - pct(p.targetDate!)}%` }}
          />
        )}
        <div
          className={cn("absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-[5px] border", s.bar)}
          style={{ left: `${left}%`, width: `${width}%` }}
        >
          <div className={cn("h-full", s.fill)} style={{ width: `${p.progressPercent}%` }} />
        </div>
        {late && (
          <span
            className="bg-danger ring-card absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 ring-2"
            style={{ left: `${pct(p.targetDate!)}%` }}
          />
        )}
      </div>
    </li>
  )
}
