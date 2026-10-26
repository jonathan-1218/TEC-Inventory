import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FolderKanban, ListChecks } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { IssuanceStatusBadge, ProjectStatusBadge } from "@/components/badges"
import { ActivityHeatmap, ProgressRing } from "@/components/charts"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { TaskRow, type TaskItem } from "@/components/tasks/task-parts"
import { TeamHeaderActions } from "@/components/teams/team-actions"
import { TeamMemberList, type TeamMemberData } from "@/components/teams/team-card"
import { isAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { calendarDay, daysOverdue, formatDate, isOverdue, toDateInput, todayNoonUTC } from "@/lib/dates"
import { cn } from "@/lib/utils"

export async function generateMetadata(props: PageProps<"/teams/[id]">): Promise<Metadata> {
  const { id } = await props.params
  const t = await db.team.findUnique({ where: { id }, select: { name: true } })
  return { title: t?.name ?? "Team not found" }
}

const DAY = 86_400_000
const WEEKS = 26
const CLOSED = ["COMPLETED", "DROPPED"]
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export default async function TeamPage(props: PageProps<"/teams/[id]">) {
  const { id } = await props.params
  const todayDate = todayNoonUTC()
  const today = toDateInput(todayDate)
  const since = new Date(todayDate.getTime() - WEEKS * 7 * DAY)
  // Relation filters (not ids from the team row) so every query runs in one parallel round trip.
  const ofTeamProjects = { project: { teamId: id } }
  const byTeamMembers = { issuedTo: { teams: { some: { teamId: id } } } }

  const [team, openTasks, loans, checkouts, updates, completions, admin, candidates] = await Promise.all([
    db.team.findUnique({
      where: { id },
      include: {
        members: {
          select: { roleInTeam: true, member: { select: { id: true, name: true, designation: true, isActive: true } } },
        },
        projects: {
          select: {
            id: true,
            title: true,
            status: true,
            progressPercent: true,
            targetDate: true,
            tasks: { select: { status: true, dueDate: true } },
          },
          orderBy: { title: "asc" },
        },
      },
    }),
    db.task.findMany({
      where: { ...ofTeamProjects, status: { not: "DONE" } },
      include: { assignee: { select: { id: true, name: true } }, project: { select: { id: true, title: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { order: "asc" }],
    }),
    db.issuance.findMany({
      where: { returnedDate: null, ...byTeamMembers },
      include: {
        component: { select: { id: true, name: true } },
        issuedTo: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: [{ expectedReturnDate: "asc" }, { issuedDate: "asc" }],
    }),
    db.issuance.findMany({
      where: {
        ...byTeamMembers,
        OR: [{ issuedDate: { gte: since } }, { returnedDate: { gte: since } }],
      },
      select: { issuedDate: true, returnedDate: true, componentId: true, issuedToMemberId: true },
    }),
    db.progressUpdate.findMany({ where: { ...ofTeamProjects, date: { gte: since } }, select: { date: true } }),
    db.task.findMany({
      where: { ...ofTeamProjects, completedAt: { gte: since } },
      select: { completedAt: true },
    }),
    isAdmin(),
    db.member.findMany({
      where: { isActive: true, guest: false, teams: { none: { teamId: id } } },
      select: { id: true, name: true, rollNumber: true },
      orderBy: { name: "asc" },
    }),
  ])
  if (!team) notFound()
  const memberIds = team.members.map((m) => m.member.id)

  // ---------- Derived ----------
  const members: TeamMemberData[] = team.members
    .map(({ roleInTeam, member }) => ({ ...member, roleInTeam, isLead: roleInTeam.trim().toLowerCase() === "team lead" }))
    .sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.name.localeCompare(b.name))

  const tasks: TaskItem[] = openTasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    assignee: t.assignee,
    project: t.project,
  }))
  const lateTasks = tasks.filter((t) => t.dueDate && toDateInput(t.dueDate) < today).length
  const tasksOf = (memberId: string | null) => tasks.filter((t) => (t.assignee?.id ?? null) === memberId)
  // Team members first (in roster order), then anyone else assigned on the team's projects, then unassigned.
  const outsiders = [
    ...new Map(tasks.flatMap((t) => (t.assignee && !memberIds.includes(t.assignee.id) ? [[t.assignee.id, t.assignee]] : []))).values(),
  ]
  const byPerson = [
    ...members.map((m) => ({ key: m.id, person: { id: m.id, name: m.name }, role: m.roleInTeam, tasks: tasksOf(m.id) })),
    ...outsiders.map((p) => ({ key: p.id, person: p, role: "Not on this team", tasks: tasksOf(p.id) })),
    { key: "none", person: null, role: "", tasks: tasksOf(null) },
  ]
  const busy = byPerson.filter((g) => g.tasks.length > 0)
  const idle = members.filter((m) => tasksOf(m.id).length === 0)
  const notes = Object.fromEntries(
    members.map((m) => [m.id, tasksOf(m.id).length ? plural(tasksOf(m.id).length, "open task") : ""])
  )

  const openProjects = team.projects.filter((p) => !CLOSED.includes(p.status))
  const avgProgress = openProjects.length
    ? Math.round(openProjects.reduce((n, p) => n + p.progressPercent, 0) / openProjects.length)
    : null
  const unitsOut = loans.reduce((n, l) => n + l.quantity, 0)

  // Activity: checkouts (split returns count once) + returns by members, updates + finished tasks on the projects.
  const counts = new Map<string, number>()
  const bump = (d: string) => counts.set(d, (counts.get(d) ?? 0) + 1)
  const sinceKey = toDateInput(since)
  for (const key of new Set(checkouts.map((c) => `${toDateInput(c.issuedDate)}|${c.componentId}|${c.issuedToMemberId}`))) {
    const d = key.slice(0, 10)
    if (d >= sinceKey) bump(d)
  }
  for (const c of checkouts) if (c.returnedDate && toDateInput(c.returnedDate) >= sinceKey) bump(toDateInput(c.returnedDate))
  for (const u of updates) bump(toDateInput(u.date))
  for (const t of completions) if (t.completedAt) bump(toDateInput(calendarDay(t.completedAt)))
  const activity = [...counts].map(([date, count]) => ({ date, count }))

  const readouts = [
    { label: "Members", value: members.length, hint: `${members.filter((m) => m.isActive).length} active` },
    { label: "Active projects", value: team.projects.filter((p) => p.status === "PLANNING" || p.status === "IN_PROGRESS").length, hint: `${team.projects.length} in total` },
    { label: "Avg progress", value: avgProgress === null ? "—" : `${avgProgress}%`, hint: "open projects" },
    { label: "Open tasks", value: tasks.length, hint: lateTasks ? `${lateTasks} overdue` : "none overdue", danger: lateTasks > 0 },
    { label: "Units with members", value: unitsOut, hint: plural(loans.length, "checkout") },
  ]

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow={
          <>
            <Link href="/teams" className="hover:text-foreground">
              Teams
            </Link>{" "}
            · {plural(members.length, "member")}
          </>
        }
        title={team.name}
        description={team.description ?? undefined}
      >
        {admin && <TeamHeaderActions team={{ id: team.id, name: team.name, description: team.description }} candidates={candidates} />}
      </PageHeader>

      <dl className="bg-card grid grid-cols-2 divide-x divide-y rounded-xl border sm:grid-cols-5 sm:divide-y-0">
        {readouts.map((r) => (
          <div key={r.label} className="grid gap-1 p-4 last:max-sm:col-span-2">
            <dt className="eyebrow">{r.label}</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">{r.value}</dd>
            <dd className={cn("text-muted-foreground text-xs", r.danger && "text-danger font-medium")}>{r.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <p className="eyebrow">Building</p>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {team.projects.length === 0 ? (
              <div className="px-4">
                <EmptyState icon={FolderKanban} title="No projects yet" description="Assign a project to this team from its edit dialog." />
              </div>
            ) : (
              <ul>
                {team.projects.map((p) => {
                  const done = p.tasks.filter((t) => t.status === "DONE").length
                  const late = p.tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < todayDate).length
                  const pastTarget = !CLOSED.includes(p.status) && !!p.targetDate && p.targetDate < todayDate
                  return (
                    <li key={p.id} className="hover:bg-muted/40 flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                      <ProgressRing value={p.progressPercent} size="md" label={`${p.title} progress`} className="max-sm:hidden" />
                      <ProgressRing value={p.progressPercent} size="sm" label={`${p.title} progress`} className="sm:hidden" />
                      <div className="grid min-w-0 flex-1 gap-1">
                        <Link href={`/projects/${p.id}`} className="hover:text-brand-strong truncate font-medium">
                          {p.title}
                        </Link>
                        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <ProjectStatusBadge status={p.status} />
                          <span>
                            {p.tasks.length ? (
                              <>
                                <span className="text-foreground font-mono tabular-nums">
                                  {done}/{p.tasks.length}
                                </span>{" "}
                                tasks done
                              </>
                            ) : (
                              "No tasks yet"
                            )}
                            {late > 0 && <span className="text-danger font-medium"> · {late} overdue</span>}
                          </span>
                          <span className={cn(pastTarget && "text-danger font-medium")}>
                            {p.targetDate ? `Target ${formatDate(p.targetDate)}` : "No target date"}
                            {pastTarget && " (past)"}
                          </span>
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <p className="eyebrow">Roster</p>
            <CardTitle>Members & roles</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamMemberList team={{ id: team.id, name: team.name }} members={members} notes={notes} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="eyebrow">Last {WEEKS} weeks</p>
          <CardTitle>Team activity</CardTitle>
          <CardDescription>
            Checkouts and returns by the team&apos;s members, plus progress updates and finished tasks on its projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap data={activity} weeks={WEEKS} end={today} unit="actions" />
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section aria-labelledby="open-tasks" className="bg-card overflow-hidden rounded-xl border lg:col-span-2">
          <header className="border-b p-4">
            <p className="eyebrow">Who&apos;s on what</p>
            <h2 id="open-tasks" className="text-base font-semibold">Open tasks by member</h2>
          </header>
          {busy.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={ListChecks} title="No open tasks" description="Everything on this team's projects is done." />
            </div>
          ) : (
            <div>
              {busy.map((g) => {
                const late = g.tasks.filter((t) => t.dueDate && toDateInput(t.dueDate) < today).length
                return (
                  <div key={g.key} className="border-b last:border-b-0">
                    <div className="bg-muted/30 flex items-center gap-2 border-b px-4 py-2">
                      <h3 className="text-sm font-semibold">
                        {g.person ? (
                          <Link href={`/members/${g.person.id}`} className="hover:text-brand-strong">
                            {g.person.name}
                          </Link>
                        ) : (
                          "Unassigned"
                        )}
                      </h3>
                      {g.role && <span className="text-muted-foreground text-xs">{g.role}</span>}
                      <span className="text-muted-foreground ms-auto font-mono text-xs tabular-nums">
                        {g.tasks.length}
                        {late > 0 && <span className="text-danger font-sans font-medium"> · {late} overdue</span>}
                      </span>
                    </div>
                    <ul>
                      {g.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} today={today} admin={admin} showProject showAssignee={false} />
                      ))}
                    </ul>
                  </div>
                )
              })}
              {idle.length > 0 && (
                <p className="text-muted-foreground border-t px-4 py-3 text-xs">
                  No open tasks: {idle.map((m) => m.name).join(", ")}
                </p>
              )}
            </div>
          )}
        </section>

        <Card>
          <CardHeader className="border-b">
            <p className="eyebrow">On loan</p>
            <CardTitle>Components with members</CardTitle>
            <CardDescription>Open checkouts by anyone on this team.</CardDescription>
          </CardHeader>
          <CardContent className={cn(loans.length > 0 && "px-0")}>
            {loans.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing checked out right now.</p>
            ) : (
              <ul>
                {loans.map((l) => (
                  <li key={l.id} className="grid gap-1 border-b px-4 py-2.5 last:border-b-0">
                    <p className="truncate text-sm font-medium">
                      <span className="font-mono tabular-nums">{l.quantity}×</span>{" "}
                      <Link href={`/inventory/${l.component.id}`} className="hover:text-brand-strong">
                        {l.component.name}
                      </Link>
                    </p>
                    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <Link href={`/members/${l.issuedTo.id}`} className="hover:text-foreground">
                        {l.issuedTo.name}
                      </Link>
                      {l.project && (
                        <>
                          ·
                          <Link href={`/projects/${l.project.id}`} className="hover:text-foreground truncate">
                            {l.project.title}
                          </Link>
                        </>
                      )}
                      · due {formatDate(l.expectedReturnDate)}
                      <IssuanceStatusBadge
                        returned={false}
                        overdueDays={isOverdue(l) && l.expectedReturnDate ? daysOverdue(l.expectedReturnDate) : 0}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
