import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, PackageOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IssuanceStatusBadge, ProjectStatusBadge } from "@/components/badges"
import { ProgressRing } from "@/components/charts"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { GoalBanner } from "@/components/projects/goal-banner"
import { getClubGoal, goalFor, goalStatus } from "@/lib/goals"
import { db } from "@/lib/db"
import { daysOverdue, formatDate, isOverdue } from "@/lib/dates"
import { teamSession } from "@/lib/team-auth"

export const metadata: Metadata = { title: "My project" }

export default async function MyProjectPage() {
  const team = await teamSession()
  if (!team) redirect("/login?next=/my")

  const project = await db.project.findUnique({
    where: { id: team.projectId },
    select: {
      id: true,
      title: true,
      status: true,
      progressPercent: true,
      startDate: true,
      createdAt: true,
      goalPercent: true,
      goalDate: true,
      mentor: { select: { name: true, designation: true, department: true } },
      team: { select: { id: true, name: true } },
      members: { select: { roleInProject: true, member: { select: { id: true, name: true, rollNumber: true, department: true } } } },
      _count: { select: { tasks: { where: { status: { not: "DONE" } } }, progressUpdates: true } },
    },
  })
  if (!project) redirect("/login")
  const goal = goalStatus(project, goalFor(project, await getClubGoal()))
  const memberIds = project.members.map((m) => m.member.id)
  // Anything checked out for the project, or to one of its members.
  const loans = await db.issuance.findMany({
    where: { OR: [{ projectId: project.id }, { issuedToMemberId: { in: memberIds } }] },
    include: { component: { select: { id: true, name: true } }, issuedTo: { select: { name: true } } },
    orderBy: [{ returnedDate: { sort: "desc", nulls: "first" } }, { issuedDate: "desc" }],
    take: 100,
  })
  const open = loans.filter((l) => !l.returnedDate)
  const overdue = open.filter((l) => isOverdue(l)).length
  const stats = [
    { label: "Parts out now", value: open.reduce((n, l) => n + l.quantity, 0) },
    { label: "Overdue loans", value: overdue, alert: overdue > 0 },
    { label: "Open tasks", value: project._count.tasks },
    { label: "Progress updates", value: project._count.progressUpdates },
  ]

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow={
          project.team ? (
            <Link href={`/teams/${project.team.id}`} className="hover:text-foreground">
              Team · {project.team.name}
            </Link>
          ) : (
            "Your team"
          )
        }
        title={project.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} /> {project.progressPercent}% done
            {project.mentor && (
              <>
                {" "}
                · Mentor: {project.mentor.name}, {project.mentor.designation}
                {project.mentor.department && ` (${project.mentor.department})`}
              </>
            )}
          </span>
        }
      >
        <Button asChild variant="brand">
          <Link href={`/projects/${project.id}`}>
            Post progress & manage tasks <ArrowRight />
          </Link>
        </Button>
      </PageHeader>

      {goal && <GoalBanner status={goal} progress={project.progressPercent} />}

      <section aria-label="Overview" className="bg-card grid gap-5 rounded-xl border p-5 md:grid-cols-[auto_1fr] md:items-center">
        <ProgressRing value={project.progressPercent} size="lg" label={`${project.title} progress`} />
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((st) => (
            <div key={st.label} className="rounded-lg border px-4 py-3">
              <dt className="eyebrow text-[10px]">{st.label}</dt>
              <dd className={`font-display mt-1 text-3xl font-extrabold tabular-nums ${st.alert ? "text-danger" : ""}`}>{st.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Card>
        <CardHeader className="border-b">
          <p className="eyebrow">Team</p>
          <CardTitle>{project.members.length === 1 ? "Individual project" : `${project.members.length} members`}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {project.members.map((m) => (
              <li key={m.member.id} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="bg-brand/15 text-brand-strong grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold">
                  {m.member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="min-w-0">
                  <Link href={`/members/${m.member.id}`} className="block truncate text-sm font-medium hover:text-brand-strong">
                    {m.member.name}
                  </Link>
                  <span className="text-muted-foreground block truncate text-xs">
                    <span className="font-mono">{m.member.rollNumber}</span> · {m.member.department} · {m.roleInProject}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <p className="eyebrow">Loans</p>
          <CardTitle>Parts your team has borrowed</CardTitle>
          <CardDescription>
            {open.length} out now. Returns are recorded by a club admin when you hand parts back.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {loans.length === 0 ? (
            <div className="px-4">
              <EmptyState icon={PackageOpen} title="Nothing borrowed yet" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4">Component</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Taken by</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due / returned</TableHead>
                  <TableHead className="pe-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="ps-4">
                      <Link href={`/inventory/${l.component.id}`} className="font-medium hover:text-brand-strong">
                        {l.component.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{l.quantity}</TableCell>
                    <TableCell>{l.issuedTo.name}</TableCell>
                    <TableCell className="font-mono text-xs">{formatDate(l.issuedDate)}</TableCell>
                    <TableCell className="font-mono text-xs">{formatDate(l.returnedDate ?? l.expectedReturnDate)}</TableCell>
                    <TableCell className="pe-4">
                      <IssuanceStatusBadge
                        returned={!!l.returnedDate}
                        overdueDays={!l.returnedDate && isOverdue(l) && l.expectedReturnDate ? daysOverdue(l.expectedReturnDate) : 0}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
