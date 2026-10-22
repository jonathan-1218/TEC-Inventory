import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarClock, CircleCheck, ListChecks, PackageOpen, Plus, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PriorityBars, ProjectStatusBadge, TaskStatusIcon } from "@/components/badges"
import { ProgressRing } from "@/components/charts"
import { GoalBanner } from "@/components/projects/goal-banner"
import { db } from "@/lib/db"
import { formatDate, toDateInput, todayNoonUTC } from "@/lib/dates"
import { getClubGoal, goalFor, goalStatus } from "@/lib/goals"
import { requireTeam } from "@/lib/portal"

export const metadata: Metadata = { title: "Team overview" }

const RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

export default async function TeamOverviewPage() {
  const { projectId } = await requireTeam()
  const [project, club] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true, title: true, description: true, status: true, progressPercent: true, startDate: true, createdAt: true,
        goalPercent: true, goalDate: true, targetDate: true,
        team: { select: { name: true } },
        mentor: { select: { name: true, designation: true, department: true } },
        members: { select: { roleInProject: true, member: { select: { id: true, name: true, department: true } } } },
        tasks: { select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { name: true } } } },
        progressUpdates: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1, include: { updatedBy: { select: { name: true } } } },
        _count: { select: { progressUpdates: true } },
      },
    }),
    getClubGoal(),
  ])
  if (!project) return null

  const memberIds = project.members.map((m) => m.member.id)
  const out = await db.issuance.aggregate({
    _sum: { quantity: true },
    where: { returnedDate: null, OR: [{ projectId }, { issuedToMemberId: { in: memberIds } }] },
  })
  const goal = goalStatus(project, goalFor(project, club))
  const today = toDateInput(todayNoonUTC())
  const open = project.tasks.filter((t) => t.status !== "DONE")
  const next = [...open]
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) || RANK[a.priority] - RANK[b.priority])
    .slice(0, 4)
  const latest = project.progressUpdates[0]
  const stats = [
    { label: "Open tasks", value: open.length, icon: ListChecks, href: "/team/tasks" },
    { label: "Tasks done", value: project.tasks.length - open.length, icon: CircleCheck, href: "/team/tasks" },
    { label: "Updates posted", value: project._count.progressUpdates, icon: TrendingUp, href: "/team/updates" },
    { label: "Parts out", value: out._sum.quantity ?? 0, icon: PackageOpen, href: "/team/parts" },
  ]

  return (
    <div className="grid gap-8">
      {/* Hero */}
      <section className="bg-card relative overflow-hidden rounded-3xl border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_100%_0%,color-mix(in_oklab,var(--brand)_22%,transparent),transparent),radial-gradient(40%_60%_at_0%_100%,color-mix(in_oklab,var(--brand)_8%,transparent),transparent)]"
        />
        <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="grid gap-4">
            <p className="eyebrow flex items-center gap-2">
              <span aria-hidden className="bg-brand h-2.5 w-[3px] rounded-[1px]" />
              {project.team ? `Team · ${project.team.name}` : "Your project"}
            </p>
            <h1 className="font-display text-3xl leading-[1.05] font-extrabold tracking-[-0.02em] text-balance sm:text-5xl">{project.title}</h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <ProjectStatusBadge status={project.status} />
              {project.mentor && (
                <span>
                  Mentor · <span className="text-foreground font-medium">{project.mentor.name}</span>
                  {project.mentor.designation && `, ${project.mentor.designation}`}
                </span>
              )}
              {project.targetDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" /> Target {formatDate(project.targetDate)}
                </span>
              )}
            </div>
            {project.description && <p className="text-muted-foreground max-w-xl text-sm text-pretty">{project.description}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="brand" asChild>
                <Link href="/team/updates">
                  <TrendingUp /> Post an update
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/team/tasks">
                  <Plus /> Add a task
                </Link>
              </Button>
            </div>
          </div>
          <div className="justify-self-start md:justify-self-end">
            <ProgressRing value={project.progressPercent} size="lg" label={`${project.title} progress`} />
          </div>
        </div>
      </section>

      {goal && <GoalBanner status={goal} progress={project.progressPercent} />}

      {/* Numbers */}
      <section aria-label="At a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-card group hover:border-brand/50 flex flex-col gap-3 rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_color-mix(in_oklab,var(--brand)_60%,transparent)]"
          >
            <span className="flex items-center justify-between">
              <span className="eyebrow">{label}</span>
              <Icon className="text-muted-foreground group-hover:text-brand-strong size-4 transition-colors" />
            </span>
            <span className="font-display text-4xl leading-none font-bold tabular-nums">{value}</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Up next */}
        <section className="bg-card rounded-2xl border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">Up next</h2>
            <Button variant="ghost" size="sm" asChild className="-mr-2">
              <Link href="/team/tasks">
                All tasks <ArrowRight />
              </Link>
            </Button>
          </div>
          {next.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              {project.tasks.length ? "Everything is done. Nice." : "No tasks yet. Add the first one."}
            </p>
          ) : (
            <ul className="grid divide-y">
              {next.map((t) => {
                const due = t.dueDate ? toDateInput(t.dueDate) : null
                const late = due !== null && due < today
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <TaskStatusIcon status={t.status} className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-muted-foreground truncate text-xs">{t.assignee?.name ?? "Unassigned"}</p>
                    </div>
                    <span className={late ? "text-danger text-xs font-medium" : "text-muted-foreground text-xs"}>
                      {t.dueDate ? `${late ? "Late · " : ""}${formatDate(t.dueDate)}` : "No date"}
                    </span>
                    <PriorityBars priority={t.priority} className={t.priority === "HIGH" ? "text-brand-strong" : "text-muted-foreground"} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Latest update */}
        <section className="bg-card rounded-2xl border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">Latest update</h2>
            <Button variant="ghost" size="sm" asChild className="-mr-2">
              <Link href="/team/updates">
                Progress log <ArrowRight />
              </Link>
            </Button>
          </div>
          {latest ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-3">
                <span className="bg-brand/15 text-brand-strong rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums">
                  {latest.percentAtUpdate}%
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(latest.date)}
                  {latest.updatedBy && ` · ${latest.updatedBy.name}`}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{latest.note}</p>
            </div>
          ) : (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              No updates yet. Tell your mentor what you have done so far.
            </p>
          )}
        </section>
      </div>

      {/* Team */}
      <section className="bg-card rounded-2xl border p-6">
        <h2 className="font-display mb-4 flex items-center gap-2 text-lg font-extrabold">
          <Users className="text-muted-foreground size-4" /> Your team
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {project.members.map(({ member, roleInProject }) => (
            <li key={member.id} className="bg-muted/40 flex items-center gap-3 rounded-xl p-3">
              <span className="bg-foreground text-background grid size-10 shrink-0 place-items-center rounded-full font-mono text-xs">
                {member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{member.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {roleInProject} · {member.department}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
