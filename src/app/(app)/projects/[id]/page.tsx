import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckIcon, Cpu, History, Pencil, Plus, TriangleAlert, Undo2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IssuanceStatusBadge, ProjectStatusBadge, ToneBadge } from "@/components/badges"
import { ProgressRing, ProgressTimeline } from "@/components/charts"
import { EmptyState } from "@/components/empty-state"
import { IssueDialog } from "@/components/issue-dialog"
import { PageHeader } from "@/components/page-header"
import { ReturnDialog } from "@/components/return-dialog"
import {
  DeleteUpdateButton,
  MemberDialog,
  ProjectHeaderActions,
  RemoveMemberButton,
  RemoveRequirementButton,
  RequirementDialog,
} from "@/components/projects/detail-controls"
import { ProgressUpdateForm } from "@/components/projects/progress-update-form"
import { GoalBanner } from "@/components/projects/goal-banner"
import { GoalDialog } from "@/components/projects/goal-dialog"
import { designationMap, getDesignations, labelOf } from "@/lib/designations"
import { getClubGoal, goalFor, goalStatus } from "@/lib/goals"
import { ProjectTasks } from "@/components/tasks/project-tasks"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/auth"
import { teamSession } from "@/lib/team-auth"
import { AdminProvider } from "@/components/admin-context"
import { calendarDay, daysOverdue, formatDate, isOverdue, toDateInput, todayNoonUTC } from "@/lib/dates"
import { TECH_STACK_KEYS, TECH_STACK_LABELS, parseTechStack } from "@/lib/labels"
import { getSelectOptions, withStock } from "@/lib/queries"
import { issuedCounts } from "@/lib/stock"
import { cn } from "@/lib/utils"

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params
  const p = await db.project.findUnique({ where: { id }, select: { title: true } })
  return { title: p?.title ?? "Project not found" }
}

const DAY = 86_400_000
const EARLY_UPDATES = 4 // shown before "Show earlier updates"

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params
  const admin = await isAdmin() // cookie check, no DB round trip
  // A signed-in team may post progress and manage tasks on its own project (the actions re-check this).
  const canEdit = admin || (await teamSession())?.projectId === id
  // One parallel round of queries; the write-control data (admins only) loads alongside the project.
  const roles = designationMap(await getDesignations())
  const [project, issued, options, teams, clubGoal] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true } },
        mentor: { select: { name: true, designation: true, department: true } },
        members: {
          include: { member: { select: { id: true, name: true, designation: true } } },
          orderBy: { member: { name: "asc" } },
        },
        progressUpdates: {
          include: { updatedBy: { select: { id: true, name: true } } },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        },
        components: { include: { component: true }, orderBy: { component: { name: "asc" } } },
        issuances: {
          where: { returnedDate: null },
          include: {
            component: { select: { id: true, name: true } },
            issuedTo: { select: { id: true, name: true } },
          },
          orderBy: [{ expectedReturnDate: "asc" }, { issuedDate: "asc" }],
        },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    issuedCounts(db),
    admin ? getSelectOptions() : null,
    admin ? db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    getClubGoal(),
  ])
  if (!project) notFound()
  const goal = goalStatus(project, goalFor(project, clubGoal))

  const todayDate = todayNoonUTC()
  const today = toDateInput(todayDate)
  const techStack = parseTechStack(project.techStack)
  const techGroups = TECH_STACK_KEYS.filter((k) => techStack[k].length > 0)
  const latestUpdate = project.progressUpdates[0]
  const closed = project.status === "COMPLETED" || project.status === "DROPPED"
  const targetDays = project.targetDate ? Math.round((project.targetDate.getTime() - todayDate.getTime()) / DAY) : null
  const targetOverdue = !closed && targetDays !== null && targetDays < 0
  const memberIds = new Set(project.members.map((m) => m.memberId))
  const requiredIds = new Set(project.components.map((c) => c.componentId))
  const memberCandidates = options?.members.filter((m) => !memberIds.has(m.id)) ?? []
  const componentCandidates = options?.components.filter((c) => !requiredIds.has(c.id)) ?? []

  const requirements = project.components.map((pc) => {
    const stock = withStock(pc.component, issued.get(pc.componentId) ?? 0)
    const need = pc.quantityRequired - pc.quantityIssued
    return { ...pc, available: stock.quantityAvailable, need }
  })
  const unitsRequired = requirements.reduce((n, r) => n + r.quantityRequired, 0)
  const unitsIssued = requirements.reduce((n, r) => n + r.quantityIssued, 0)

  const tasks = project.tasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    assignee: t.assignee,
  }))
  const tasksDone = tasks.filter((t) => t.status === "DONE").length
  const tasksPercent = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : null
  const openTasksBy = (memberId: string) => tasks.filter((t) => t.status !== "DONE" && t.assignee?.id === memberId).length

  // Progress chart: reported % per update, and the share of tasks done on each day tasks changed.
  const reported = [...project.progressUpdates]
    .reverse()
    .map((u) => ({ date: toDateInput(u.date), progress: u.percentAtUpdate }))
  const dayOf = (ts: Date) => toDateInput(calendarDay(ts))
  const taskDays = [
    ...new Set(project.tasks.flatMap((t) => [dayOf(t.createdAt), ...(t.completedAt ? [dayOf(t.completedAt)] : [])])),
  ].sort()
  const taskSeries = taskDays.map((d) => {
    const created = project.tasks.filter((t) => dayOf(t.createdAt) <= d).length
    const done = project.tasks.filter((t) => t.completedAt && dayOf(t.completedAt) <= d).length
    return { date: d, progress: created ? Math.round((done / created) * 100) : 0 }
  })
  const timeline = [
    { id: "reported", name: "Reported progress", points: reported },
    ...(taskSeries.length ? [{ id: "tasks", name: "Tasks done", points: taskSeries }] : []),
  ].filter((s) => s.points.length > 0)

  const earlier = project.progressUpdates.slice(EARLY_UPDATES)

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow={
          <>
            Project ·{" "}
            {project.team ? (
              <Link href={`/teams/${project.team.id}`} className="hover:text-foreground">
                {project.team.name}
              </Link>
            ) : (
              "Independent"
            )}
          </>
        }
        title={project.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ProjectStatusBadge status={project.status} />
            {project.mentor && (
              <span className="text-xs">
                Mentor: {project.mentor.name}, {project.mentor.designation}
                {project.mentor.department && ` (${project.mentor.department})`}
              </span>
            )}
            {(project.startDate || project.targetDate) && (
              <span className="font-mono text-xs">
                {formatDate(project.startDate)} →{" "}
                <span className={cn(targetOverdue && "text-danger font-medium")}>
                  {formatDate(project.targetDate)}
                  {targetOverdue && " (past target)"}
                </span>
              </span>
            )}
          </span>
        }
      >
        {admin && (
          <GoalDialog
            projectId={project.id}
            current={{ percent: project.goalPercent, date: project.goalDate ? toDateInput(project.goalDate) : null }}
          />
        )}
        {admin && (
          <ProjectHeaderActions
            teams={teams}
            project={{
              id: project.id,
              title: project.title,
              description: project.description,
              teamId: project.teamId,
              status: project.status,
              progressPercent: project.progressPercent,
              startDate: project.startDate,
              targetDate: project.targetDate,
              techStack,
            }}
          />
        )}
      </PageHeader>

      {goal && <GoalBanner status={goal} progress={project.progressPercent} />}

      {/* ---------- Overview readout ---------- */}
      <section
        aria-label="Overview"
        className="bg-card grid divide-y rounded-xl border xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.3fr)] xl:divide-x xl:divide-y-0"
      >
        <div className="flex items-center gap-5 p-5">
          <ProgressRing value={project.progressPercent} size="lg" label={`${project.title} progress`} />
          <div className="grid gap-2">
            <p className="eyebrow">Progress</p>
            <p className="text-sm">
              <span className="font-display text-2xl font-bold tabular-nums">{project.progressPercent}%</span>{" "}
              <span className="text-muted-foreground">reported</span>
            </p>
            {tasksPercent !== null && (
              <p className="text-muted-foreground text-sm">
                Tasks say{" "}
                <span
                  className={cn(
                    "font-mono font-medium tabular-nums",
                    Math.abs(tasksPercent - project.progressPercent) >= 15 ? "text-brand-strong" : "text-foreground"
                  )}
                >
                  {tasksPercent}%
                </span>
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {latestUpdate ? `Last update ${formatDate(latestUpdate.date)}` : "No updates yet"}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 content-center gap-x-6 gap-y-4 p-5 text-sm">
          <Fact label="Start">{formatDate(project.startDate)}</Fact>
          <Fact label="Target">
            {formatDate(project.targetDate)}
            {targetDays !== null && !closed && (
              <span className={cn("block text-xs", targetOverdue ? "text-danger font-medium" : "text-muted-foreground")}>
                {targetOverdue ? `${-targetDays} days past target` : targetDays === 0 ? "Due today" : `in ${targetDays} days`}
              </span>
            )}
          </Fact>
          <Fact label="Team">
            {project.team ? (
              <Link href={`/teams/${project.team.id}`} className="hover:text-brand-strong underline-offset-4 hover:underline">
                {project.team.name}
              </Link>
            ) : (
              "Independent"
            )}
          </Fact>
          <Fact label="People">
            {project.members.length} {project.members.length === 1 ? "member" : "members"}
          </Fact>
          <Fact label="Tasks">
            {tasks.length ? `${tasksDone} of ${tasks.length} done` : "None yet"}
          </Fact>
          <Fact label="Parts">
            {requirements.length ? `${unitsIssued} of ${unitsRequired} units issued` : "None listed"}
          </Fact>
        </dl>

        <div className="grid content-start gap-4 p-5">
          <div className="grid gap-1.5">
            <p className="eyebrow">About</p>
            {project.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{project.description}</p>
            ) : (
              <p className="text-muted-foreground text-sm">No description yet.</p>
            )}
          </div>
          {techGroups.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No tech stack listed{admin ? " — edit the project to add languages, frameworks and hardware." : "."}
            </p>
          ) : (
            <dl className="grid gap-2">
              {techGroups.map((k) => (
                <div key={k} className="flex flex-wrap items-center gap-1">
                  <dt className="eyebrow w-20 shrink-0 text-[10px]">{TECH_STACK_LABELS[k]}</dt>
                  {techStack[k].map((t) => (
                    <dd key={t}>
                      <Badge variant="secondary">{t}</Badge>
                    </dd>
                  ))}
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* ---------- Tasks ---------- */}
      <AdminProvider isAdmin={canEdit}>
        <ProjectTasks
          projectId={project.id}
          tasks={tasks}
          today={today}
          projectMembers={project.members.map((m) => ({ id: m.member.id, name: m.member.name }))}
          otherMembers={memberCandidates.map((m) => ({ id: m.id, name: m.name }))}
        />
      </AdminProvider>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Side column first in the DOM so members follow the tasks on phones. */}
        <div className="grid min-w-0 gap-6 lg:order-last">
          {/* ---------- Members ---------- */}
          <Card>
            <CardHeader className="border-b">
              <p className="eyebrow">Crew</p>
              <CardTitle className="flex items-center gap-2">
                Members
                <span className="text-muted-foreground font-mono text-sm font-normal tabular-nums">
                  {project.members.length}
                </span>
              </CardTitle>
              {options && (
                <CardAction>
                  <MemberDialog
                    projectId={project.id}
                    candidates={memberCandidates}
                    trigger={
                      <Button size="sm" variant="outline" disabled={memberCandidates.length === 0}>
                        <Plus /> Add
                      </Button>
                    }
                  />
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {project.members.length === 0 ? (
                <p className="text-muted-foreground text-sm">No members assigned yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {project.members.map(({ member, roleInProject }) => {
                    const open = openTasksBy(member.id)
                    return (
                      <li key={member.id} className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <Link href={`/members/${member.id}`} className="hover:text-brand-strong block truncate text-sm font-medium">
                            {member.name}
                          </Link>
                          <p className="text-muted-foreground truncate text-xs">
                            <span className="text-foreground">{roleInProject}</span> ·{" "}
                            {labelOf(roles, member.designation)}
                            {open > 0 && ` · ${open} open ${open === 1 ? "task" : "tasks"}`}
                          </p>
                        </div>
                        {admin && (
                          <div className="flex shrink-0">
                            <MemberDialog
                              projectId={project.id}
                              member={{ id: member.id, name: member.name, role: roleInProject }}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label={`Change ${member.name}'s role`}>
                                  <Pencil />
                                </Button>
                              }
                            />
                            <RemoveMemberButton projectId={project.id} member={{ id: member.id, name: member.name }} />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ---------- On loan ---------- */}
          {project.issuances.length > 0 && (
            <Card>
              <CardHeader className="border-b">
                <p className="eyebrow">On loan</p>
                <CardTitle className="flex items-center gap-2">
                  Checked out for this project
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ul>
                  {project.issuances.map((iss) => (
                    <li key={iss.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="font-mono tabular-nums">{iss.quantity}×</span>{" "}
                          <Link href={`/inventory/${iss.component.id}`} className="hover:text-brand-strong">
                            {iss.component.name}
                          </Link>
                        </p>
                        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <Link href={`/members/${iss.issuedTo.id}`} className="hover:text-foreground">
                            {iss.issuedTo.name}
                          </Link>
                          · due {formatDate(iss.expectedReturnDate)}
                          <IssuanceStatusBadge
                            returned={false}
                            overdueDays={isOverdue(iss) && iss.expectedReturnDate ? daysOverdue(iss.expectedReturnDate) : 0}
                          />
                        </p>
                      </div>
                      {admin && (
                        <ReturnDialog
                          issuance={{
                            id: iss.id,
                            quantity: iss.quantity,
                            componentName: iss.component.name,
                            memberName: iss.issuedTo.name,
                          }}
                          trigger={
                            <Button size="xs" variant="outline">
                              <Undo2 /> Return
                            </Button>
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="grid min-w-0 gap-6 lg:col-span-2">
          {/* ---------- Progress ---------- */}
          <Card>
            <CardHeader className="border-b">
              <p className="eyebrow">Progress log</p>
              <CardTitle className="flex items-center gap-2">
                Progress over time
              </CardTitle>
              <CardDescription>Project progress follows the latest update.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {timeline.length > 0 && (
                <ProgressTimeline
                  projects={timeline}
                  end={today}
                  height={200}
                  summary={`Reported progress is ${project.progressPercent}% after ${reported.length} updates${
                    tasksPercent !== null ? `; ${tasksPercent}% of tasks are done` : ""
                  }.`}
                />
              )}
              {canEdit && (
                <ProgressUpdateForm
                  projectId={project.id}
                  today={today}
                  currentPercent={project.progressPercent}
                  suggestedPercent={tasksPercent}
                  projectMembers={project.members.map((m) => m.member)}
                  otherMembers={memberCandidates}
                />
              )}
              {project.progressUpdates.length === 0 ? (
                <EmptyState icon={History} title="No progress updates yet" />
              ) : (
                <div className="grid gap-4">
                  <UpdateList updates={project.progressUpdates.slice(0, EARLY_UPDATES)} all={project.progressUpdates} admin={canEdit} />
                  {earlier.length > 0 && (
                    <details className="group">
                      <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-sm">
                        <span className="group-open:hidden">Show {earlier.length} earlier updates</span>
                        <span className="hidden group-open:inline">Hide earlier updates</span>
                      </summary>
                      <div className="mt-4">
                        <UpdateList updates={earlier} all={project.progressUpdates} admin={canEdit} />
                      </div>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---------- Components ---------- */}
          <Card>
            <CardHeader className="border-b">
              <p className="eyebrow">Parts</p>
              <CardTitle className="flex items-center gap-2">
                Required components
              </CardTitle>
              <CardDescription>
                {requirements.length
                  ? `${unitsIssued} of ${unitsRequired} units issued. Issued = units currently checked out for this project.`
                  : "Issued = units currently checked out for this project."}
              </CardDescription>
              {options && (
                <CardAction>
                  <RequirementDialog
                    projectId={project.id}
                    candidates={componentCandidates}
                    trigger={
                      <Button size="sm" variant="outline" disabled={componentCandidates.length === 0}>
                        <Plus /> Add component
                      </Button>
                    }
                  />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className={cn(requirements.length > 0 && "px-0")}>
              {requirements.length === 0 ? (
                <EmptyState icon={Cpu} title="No components required yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="ps-4">Component</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Issued</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">In stock</TableHead>
                      <TableHead>Status</TableHead>
                      {admin && <TableHead className="pe-4 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((r) => (
                      <TableRow key={r.componentId}>
                        <TableCell className="min-w-36 ps-4 font-medium whitespace-normal">
                          <Link href={`/inventory/${r.componentId}`} className="hover:text-brand-strong">
                            {r.component.name}
                          </Link>
                          {r.component.modelNumber && (
                            <span className="text-muted-foreground block font-mono text-xs">{r.component.modelNumber}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{r.quantityRequired}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{r.quantityIssued}</TableCell>
                        <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{r.available}</TableCell>
                        <TableCell>
                          {r.need <= 0 ? (
                            <ToneBadge tone="neutral">
                              <CheckIcon aria-hidden /> Fully issued
                            </ToneBadge>
                          ) : (
                            <ToneBadge tone={r.available < r.need ? "brand" : "brandOutline"}>
                              {r.available < r.need && <TriangleAlert aria-hidden />}
                              Need {r.need} more
                              {r.available < r.need && <span className="sr-only">, only {r.available} in stock</span>}
                            </ToneBadge>
                          )}
                        </TableCell>
                        {admin && (
                          <TableCell className="pe-4">
                            <div className="flex items-center justify-end gap-1">
                              {options && !closed && (
                                <IssueDialog
                                  options={options}
                                  componentId={r.componentId}
                                  projectId={project.id}
                                  trigger={
                                    <Button size="xs" variant="outline" disabled={r.available <= 0}>
                                      Issue
                                    </Button>
                                  }
                                />
                              )}
                              <RequirementDialog
                                projectId={project.id}
                                component={{
                                  id: r.componentId,
                                  name: r.component.name,
                                  required: r.quantityRequired,
                                  issued: r.quantityIssued,
                                }}
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.component.name} quantity`}>
                                    <Pencil />
                                  </Button>
                                }
                              />
                              <RemoveRequirementButton
                                projectId={project.id}
                                component={{ id: r.componentId, name: r.component.name }}
                              />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1">
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

type Update = {
  id: string
  date: Date
  note: string
  percentAtUpdate: number
  updatedBy: { id: string; name: string } | null
}

/** Timeline entries; the delta is against the next-older update in `all` (newest first). */
function UpdateList({ updates, all, admin }: { updates: Update[]; all: Update[]; admin: boolean }) {
  return (
    <ol className="border-border ms-2 grid gap-5 border-s">
      {updates.map((u) => {
        const prev = all[all.indexOf(u) + 1]
        const delta = prev ? u.percentAtUpdate - prev.percentAtUpdate : null
        return (
          <li key={u.id} className="relative ps-5">
            <span aria-hidden className="bg-brand ring-card absolute top-1.5 -start-[5px] size-2.5 rounded-[3px] ring-4" />
            <div className="flex flex-wrap items-center gap-2">
              <time dateTime={toDateInput(u.date)} className="font-mono text-xs font-medium">
                {formatDate(u.date)}
              </time>
              <ToneBadge tone="brand" className="font-mono tabular-nums">
                {u.percentAtUpdate}%
              </ToneBadge>
              {delta !== null && delta !== 0 && (
                <span className={cn("font-mono text-xs tabular-nums", delta > 0 ? "text-muted-foreground" : "text-brand-strong")}>
                  {delta > 0 ? "+" : "−"}
                  {Math.abs(delta)} pts
                </span>
              )}
              {admin && (
                <span className="ms-auto">
                  <DeleteUpdateButton id={u.id} />
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{u.note}</p>
            {u.updatedBy && (
              <p className="text-muted-foreground mt-1 text-xs">
                by{" "}
                <Link href={`/members/${u.updatedBy.id}`} className="hover:text-foreground">
                  {u.updatedBy.name}
                </Link>
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
