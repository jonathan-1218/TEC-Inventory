import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cache } from "react"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConditionBadge, IssuanceStatusBadge, ProjectStatusBadge } from "@/components/badges"
import { PageHeader } from "@/components/page-header"
import { ReturnDialog } from "@/components/return-dialog"
import { MemberActions } from "@/components/members/member-actions"
import { ActiveBadge, DesignationBadge } from "@/components/members/member-badges"
import { isAdmin } from "@/lib/auth"
import { daysOverdue, formatDate, isOverdue } from "@/lib/dates"
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
    },
  })
)

export async function generateMetadata(props: PageProps<"/members/[id]">): Promise<Metadata> {
  const member = await getMember((await props.params).id)
  return { title: member?.name ?? "Member not found" }
}

export default async function MemberPage(props: PageProps<"/members/[id]">) {
  const { id } = await props.params
  const member = await getMember(id)
  if (!member) notFound()
  const { teams, projects, issuances, ...details } = member

  const admin = await isAdmin()
  const [options, departments] = await Promise.all([
    admin && member.isActive ? getSelectOptions() : null,
    admin ? db.member.findMany({ distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }) : [],
  ])

  const open = issuances
    .filter((i) => !i.returnedDate)
    // Soonest due first; no due date last.
    .sort((a, b) => (a.expectedReturnDate?.getTime() ?? Infinity) - (b.expectedReturnDate?.getTime() ?? Infinity))
  const returned = issuances.filter((i) => i.returnedDate)
  const unitsOut = open.reduce((n, i) => n + i.quantity, 0)

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/members" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Members
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {member.name}
            <DesignationBadge designation={member.designation} />
            <ActiveBadge active={member.isActive} />
          </span>
        }
        description={
          <>
            <span className="font-mono">{member.rollNumber}</span> · {member.department} · Year {member.yearOfStudy}
          </>
        }
      >
        <MemberActions
          member={details}
          departments={departments.map((d) => d.department)}
          options={options}
          openIssuances={open.length}
        />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a href={`mailto:${member.email}`} className="flex min-w-0 items-center gap-2 hover:underline">
              <Mail className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate">{member.email}</span>
            </a>
            {member.phone ? (
              <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 tabular-nums hover:underline">
                <Phone className="text-muted-foreground size-4 shrink-0" />
                {member.phone}
              </a>
            ) : (
              <p className="text-muted-foreground flex items-center gap-2">
                <Phone className="size-4 shrink-0" /> No phone on file
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-muted-foreground">Not on any team.</p>
            ) : (
              <ul className="grid gap-2">
                {teams.map((t) => (
                  <li key={t.teamId} className="flex items-center justify-between gap-2">
                    <Link href={`/teams#${t.team.id}`} className="truncate font-medium hover:underline">
                      {t.team.name}
                    </Link>
                    <span className="text-muted-foreground shrink-0 text-xs">{t.roleInTeam}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-muted-foreground">Not on any project.</p>
            ) : (
              <ul className="grid gap-3">
                {projects.map(({ project: p, roleInProject }) => (
                  <li key={p.id} className="grid gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/projects/${p.id}`} className="block truncate font-medium hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-muted-foreground text-xs">{roleInProject}</p>
                      </div>
                      <ProjectStatusBadge status={p.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={p.progressPercent} aria-label={`${p.title} progress`} />
                      <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                        {p.progressPercent}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currently holding</CardTitle>
          <CardDescription>
            {open.length === 0
              ? "Nothing checked out right now."
              : `${unitsOut} unit(s) across ${open.length} open issuance(s).`}
          </CardDescription>
        </CardHeader>
        {open.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden md:table-cell">Project</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead>Due</TableHead>
                  {admin && (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((i) => {
                  const overdue = isOverdue(i)
                  return (
                    <TableRow key={i.id} className={cn(overdue && "bg-red-500/5 hover:bg-red-500/10")}>
                      <TableCell>
                        <Link href={`/inventory/${i.component.id}`} className="font-medium hover:underline">
                          {i.component.name}
                        </Link>
                        {i.component.modelNumber && (
                          <p className="text-muted-foreground text-xs">{i.component.modelNumber}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {i.project ? (
                          <Link href={`/projects/${i.project.id}`} className="hover:underline">
                            {i.project.title}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">{formatDate(i.issuedDate)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("tabular-nums", overdue && "text-destructive font-medium")}>
                            {formatDate(i.expectedReturnDate)}
                          </span>
                          {overdue && i.expectedReturnDate && (
                            <IssuanceStatusBadge returned={false} overdueDays={daysOverdue(i.expectedReturnDate)} />
                          )}
                        </div>
                      </TableCell>
                      {admin && (
                        <TableCell className="text-right">
                          <ReturnDialog
                            issuance={{
                              id: i.id,
                              quantity: i.quantity,
                              componentName: i.component.name,
                              memberName: member.name,
                            }}
                            trigger={
                              <Button size="sm" variant="outline">
                                Return
                              </Button>
                            }
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issuance history</CardTitle>
          <CardDescription>
            {returned.length === 0 ? "No returned issuances yet." : `${returned.length} returned issuance(s).`}
          </CardDescription>
        </CardHeader>
        {returned.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden md:table-cell">Project</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returned.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link href={`/inventory/${i.component.id}`} className="font-medium hover:underline">
                        {i.component.name}
                      </Link>
                      {i.notes && <p className="text-muted-foreground max-w-64 truncate text-xs">{i.notes}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {i.project ? (
                        <Link href={`/projects/${i.project.id}`} className="hover:underline">
                          {i.project.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{formatDate(i.issuedDate)}</TableCell>
                    <TableCell className="tabular-nums">{formatDate(i.returnedDate)}</TableCell>
                    <TableCell>
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
          </CardContent>
        )}
      </Card>
    </div>
  )
}
