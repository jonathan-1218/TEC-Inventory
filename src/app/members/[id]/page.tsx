import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { ArrowLeft, CalendarClock, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ConditionBadge,
  IssuanceStatusBadge,
  PriorityBadge,
  ProjectStatusBadge,
  TaskStatusIcon,
} from "@/components/badges"
import { ActivityHeatmap, ProgressRing } from "@/components/charts"
import { PageHeader } from "@/components/page-header"
import { Readout } from "@/components/issuances/readout"
import { ReturnDialog } from "@/components/return-dialog"
import { ExtendDueDialog } from "@/components/issuances/extend-due-dialog"
import { MemberActions } from "@/components/members/member-actions"
import { ActiveBadge, DesignationBadge, MemberAvatar } from "@/components/members/member-badges"
import { getMemberActivity } from "@/lib/analytics"
import { isAdmin } from "@/lib/auth"
import { daysOverdue, formatDate, todayNoonUTC } from "@/lib/dates"
import { db } from "@/lib/db"
import { getSelectOptions } from "@/lib/queries"
import { cn } from "@/lib/utils"

const getMember = cache((id: string) =>
  db.member.findUnique({
    where: { id },
    include: {
      teams: { include: { team: { select: { id: true, name: true } } }, orderBy: { team: { name: "asc" } } },
      projects: {
        include: { project: { select: { id: true, title: true, status: true, progressPercent: true } } },
        orderBy: { project: { title: "asc" } },
      },
      issuances: {
        include: {
          component: { select: { id: true, name: true, modelNumber: true } },
          project: { select: { id: true, title: true } },
        },
        orderBy: [{ issuedDate: "desc" }, { createdAt: "desc" }],
      },
      tasks: { include: { project: { select: { id: true, title: true } } } },
    },
  })
)

export async function generateMetadata(props: PageProps<"/members/[id]">): Promise<Metadata> {
  const member = await getMember((await props.params).id)
  return { title: member?.name ?? "Member not found" }
}

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`

export default async function MemberPage(props: PageProps<"/members/[id]">) {
  const { id } = await props.params
  const admin = await isAdmin() // cookie check, no DB round trip
  // One parallel round of queries (admin-only form data included) instead of member first, then the rest.
  const [member, adminOptions, departments, activity] = await Promise.all([
    getMember(id),
    admin ? getSelectOptions() : null,
    admin
      ? db.member.findMany({ distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } })
      : [],
    getMemberActivity(id),
  ])
  if (!member) notFound()
  const { teams, projects, issuances, tasks, ...rest } = member
  // Contact details are admin-only, stripped on the server (the client never receives them).
  const details = { ...rest, email: admin ? rest.email : null, phone: admin ? rest.phone : null }
  const options = member.isActive ? adminOptions : null

  const lateBy = (i: (typeof issuances)[number]) =>
    !i.returnedDate && i.expectedReturnDate ? Math.max(0, daysOverdue(i.expectedReturnDate)) : 0
  const open = issuances
    .filter((i) => !i.returnedDate)
    // Most overdue first, then soonest due; no due date last.
    .sort(
      (a, b) =>
        lateBy(b) - lateBy(a) ||
        (a.expectedReturnDate?.getTime() ?? Infinity) - (b.expectedReturnDate?.getTime() ?? Infinity)
    )
  const returned = issuances.filter((i) => i.returnedDate)
  const unitsOut = open.reduce((n, i) => n + i.quantity, 0)
  const overdue = open.filter((i) => lateBy(i) > 0).length

  const today = todayNoonUTC().getTime()
  const openTasks = tasks
    .filter((t) => t.status !== "DONE")
    .sort(
      (a, b) =>
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    )
  const doneTasks = tasks
    .filter((t) => t.status === "DONE")
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))

  const sum = (k: "issues" | "returns" | "updates" | "tasks") => activity.reduce((n, d) => n + d[k], 0)
  const breakdown = [
    [sum("issues"), "checkout"],
    [sum("returns"), "return"],
    [sum("updates"), "progress update"],
    [sum("tasks"), "task done", "tasks done"],
  ] as const

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid gap-3">
        <Link href="/members" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> Members
        </Link>
        <PageHeader
          eyebrow={
            <>
              Member · <span className="text-foreground">{member.rollNumber}</span>
            </>
          }
          title={
            <span className="flex items-center gap-4">
              <MemberAvatar
                name={member.name}
                className="size-12 sm:size-14 [&_[data-slot=avatar-fallback]]:text-base sm:[&_[data-slot=avatar-fallback]]:text-lg"
              />
              {member.name}
            </span>
          }
          description={
            <span className="grid gap-2">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <DesignationBadge designation={member.designation} />
                <span aria-hidden className="text-border">
                  /
                </span>
                <span>{member.department}</span>
                <span aria-hidden className="text-border">
                  /
                </span>
                <span className="font-mono text-xs">Year {member.yearOfStudy}</span>
                <span aria-hidden className="text-border">
                  /
                </span>
                <ActiveBadge active={member.isActive} />
              </span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {details.email && (
                  <a href={`mailto:${details.email}`} className="hover:text-foreground inline-flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {details.email}
                  </a>
                )}
                {details.phone && (
                  <a
                    href={`tel:${details.phone.replace(/\s/g, "")}`}
                    className="hover:text-foreground inline-flex items-center gap-1.5 font-mono tabular-nums"
                  >
                    <Phone className="size-3.5" /> {details.phone}
                  </a>
                )}
              </span>
            </span>
          }
        >
          <MemberActions
            member={details}
            departments={departments.map((d) => d.department)}
            options={options}
            openIssuances={open.length}
          />
        </PageHeader>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Readout label="On loan now" value={unitsOut} context={plural(open.length, "checkout")} />
        <Readout
          label="Overdue"
          value={overdue}
          context={overdue ? "needs a nudge" : "nothing late"}
          alert={overdue > 0}
        />
        <Readout label="Checkouts" value={issuances.length} context={`${returned.length} returned, all time`} />
        <Readout label="Open tasks" value={openTasks.length} context={`${doneTasks.length} done`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardHeader>
              <p className="eyebrow">Activity · 26 weeks</p>
              <CardTitle>What {member.name.split(" ")[0]} has been up to</CardTitle>
              <CardDescription className="font-mono text-xs">
                {breakdown.map(([n, one, many], i) => (
                  <span key={one}>
                    {i > 0 && " · "}
                    {n} {n === 1 ? one : (many ?? `${one}s`)}
                  </span>
                ))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap data={activity.map((d) => ({ date: d.date, count: d.total }))} unit="activities" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="eyebrow">On loan</p>
              <CardTitle>Currently holding</CardTitle>
              <CardDescription>
                {open.length === 0
                  ? "Nothing checked out right now."
                  : `${plural(unitsOut, "unit")} across ${plural(open.length, "checkout")}.`}
              </CardDescription>
            </CardHeader>
            {open.length > 0 && (
              <CardContent>
                <ul className="divide-y">
                  {open.map((i) => {
                    const late = lateBy(i)
                    return (
                      <li
                        key={i.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-3 gap-y-2 border-l-2 py-3 pl-3 first:pt-1 last:pb-1",
                          late > 0 ? "border-l-danger" : "border-l-transparent"
                        )}
                      >
                        <span className="bg-muted grid h-8 min-w-8 place-items-center rounded-md px-1.5 font-mono text-xs font-semibold tabular-nums">
                          {i.quantity}×
                        </span>
                        <div className="min-w-0 flex-1 basis-48">
                          <Link href={`/inventory/${i.component.id}`} className="hover:text-brand-strong font-medium">
                            {i.component.name}
                          </Link>
                          <p className="text-muted-foreground truncate text-xs">
                            {i.component.modelNumber && <span className="font-mono">{i.component.modelNumber} · </span>}
                            since <span className="font-mono">{formatDate(i.issuedDate)}</span>
                            {i.project && (
                              <>
                                {" · "}
                                <Link href={`/projects/${i.project.id}`} className="hover:text-foreground">
                                  {i.project.title}
                                </Link>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("font-mono text-xs tabular-nums", late > 0 ? "text-danger font-medium" : "text-muted-foreground")}
                          >
                            {i.expectedReturnDate ? `due ${formatDate(i.expectedReturnDate)}` : "no due date"}
                          </span>
                          <IssuanceStatusBadge returned={false} overdueDays={late} />
                          {admin && (
                            <>
                              <ExtendDueDialog
                                issuance={{
                                  id: i.id,
                                  componentName: i.component.name,
                                  memberName: member.name,
                                  expectedReturnDate: i.expectedReturnDate,
                                }}
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label={`Extend due date of ${i.component.name}`}>
                                    <CalendarClock />
                                  </Button>
                                }
                              />
                              <ReturnDialog
                                issuance={{
                                  id: i.id,
                                  quantity: i.quantity,
                                  componentName: i.component.name,
                                  memberName: member.name,
                                }}
                                trigger={
                                  <Button size="sm" variant="outline" aria-label={`Return ${i.component.name}`}>
                                    Return
                                  </Button>
                                }
                              />
                            </>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <p className="eyebrow">Tasks</p>
              <CardTitle>Assigned tasks</CardTitle>
              <CardDescription>
                {tasks.length === 0 ? "No tasks assigned." : `${openTasks.length} open · ${doneTasks.length} done`}
              </CardDescription>
            </CardHeader>
            {tasks.length > 0 && (
              <CardContent>
                <ul className="divide-y">
                  {[...openTasks, ...doneTasks.slice(0, 5)].map((t) => {
                    const done = t.status === "DONE"
                    const late = !done && t.dueDate && t.dueDate.getTime() < today
                    return (
                      <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <TaskStatusIcon
                          status={t.status}
                          className={cn(t.status === "IN_PROGRESS" && "text-brand-strong", t.status === "TODO" && "text-muted-foreground")}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-sm", done && "text-muted-foreground line-through decoration-1")}>
                            {t.title}
                          </p>
                          <Link href={`/projects/${t.project.id}`} className="text-muted-foreground hover:text-foreground text-xs">
                            {t.project.title}
                          </Link>
                        </div>
                        {!done && <PriorityBadge priority={t.priority} className="hidden sm:inline-flex" />}
                        <span
                          className={cn(
                            "w-24 shrink-0 text-right font-mono text-xs tabular-nums",
                            late ? "text-danger font-medium" : "text-muted-foreground"
                          )}
                        >
                          {done ? `done ${formatDate(t.completedAt)}` : t.dueDate ? formatDate(t.dueDate) : "no due date"}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {doneTasks.length > 5 && (
                  <p className="text-muted-foreground mt-3 text-xs">+ {doneTasks.length - 5} more done</p>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardHeader>
              <p className="eyebrow">Teams</p>
              <CardTitle>Teams & roles</CardTitle>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <p className="text-muted-foreground">Not on any team.</p>
              ) : (
                <ul className="grid gap-2.5">
                  {teams.map((t) => (
                    <li key={t.teamId} className="flex items-center justify-between gap-2">
                      <Link href={`/teams/${t.team.id}`} className="hover:text-brand-strong truncate font-medium">
                        {t.team.name}
                      </Link>
                      <span className="eyebrow shrink-0">{t.roleInTeam}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="eyebrow">Projects</p>
              <CardTitle>Projects & roles</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-muted-foreground">Not on any project.</p>
              ) : (
                <ul className="grid gap-4">
                  {projects.map(({ project: p, roleInProject }) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <ProgressRing value={p.progressPercent} size="sm" label={`${p.title} progress`} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/projects/${p.id}`} className="hover:text-brand-strong block truncate font-medium">
                          {p.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <ProjectStatusBadge status={p.status} />
                          <span className="text-muted-foreground text-xs">{roleInProject}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b pb-4">
          <p className="eyebrow">Log</p>
          <CardTitle>Issuance history</CardTitle>
          <CardDescription>
            {returned.length === 0 ? "No returned issuances yet." : `${plural(returned.length, "returned issuance")}.`}
          </CardDescription>
        </CardHeader>
        {returned.length > 0 && (
          <Table className="[&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="hidden md:table-cell">Project</TableHead>
                <TableHead className="hidden sm:table-cell">Issued</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead className="hidden sm:table-cell">Condition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returned.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/inventory/${i.component.id}`} className="hover:text-brand-strong font-medium">
                      {i.component.name}
                    </Link>
                    {i.notes && <p className="text-muted-foreground max-w-64 truncate text-xs">{i.notes}</p>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{i.quantity}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {i.project ? (
                      <Link href={`/projects/${i.project.id}`} className="hover:text-brand-strong">
                        {i.project.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden font-mono text-xs sm:table-cell">
                    {formatDate(i.issuedDate)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatDate(i.returnedDate)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {i.conditionOnReturn ? (
                      <ConditionBadge condition={i.conditionOnReturn} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
