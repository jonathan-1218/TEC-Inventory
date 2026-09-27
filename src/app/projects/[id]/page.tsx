import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Cpu, History, Layers, PackageOpen, Pencil, Plus, Undo2, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IssuanceStatusBadge, ProjectStatusBadge, ToneBadge } from "@/components/badges"
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
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/auth"
import { daysOverdue, formatDate, isOverdue, toDateInput, todayNoonUTC } from "@/lib/dates"
import { DESIGNATION_LABELS, TECH_STACK_KEYS, TECH_STACK_LABELS, parseTechStack } from "@/lib/labels"
import { getSelectOptions, withStock } from "@/lib/queries"
import { issuedCounts } from "@/lib/stock"

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params
  const p = await db.project.findUnique({ where: { id }, select: { title: true } })
  return { title: p?.title ?? "Project not found" }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params
  const [project, issued, admin] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true } },
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
      },
    }),
    issuedCounts(db),
    isAdmin(),
  ])
  if (!project) notFound()

  // Write-control data is only needed by admins.
  const options = admin ? await getSelectOptions() : null
  const teams = admin ? await db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : []

  const techStack = parseTechStack(project.techStack)
  const techGroups = TECH_STACK_KEYS.filter((k) => techStack[k].length > 0)
  const latestUpdate = project.progressUpdates[0]
  const closed = project.status === "COMPLETED" || project.status === "DROPPED"
  const targetOverdue = !closed && !!project.targetDate && project.targetDate < todayNoonUTC()
  const memberIds = new Set(project.members.map((m) => m.memberId))
  const requiredIds = new Set(project.components.map((c) => c.componentId))
  const memberCandidates = options?.members.filter((m) => !memberIds.has(m.id)) ?? []
  const componentCandidates = options?.components.filter((c) => !requiredIds.has(c.id)) ?? []

  const requirements = project.components.map((pc) => {
    const stock = withStock(pc.component, issued.get(pc.componentId) ?? 0)
    const need = pc.quantityRequired - pc.quantityIssued
    return { ...pc, available: stock.quantityAvailable, need }
  })

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {project.title} <ProjectStatusBadge status={project.status} />
          </span>
        }
        description={
          <>
            {project.team ? (
              <Link href={`/teams#${project.team.id}`} className="text-foreground hover:underline">
                {project.team.name}
              </Link>
            ) : (
              "Independent project"
            )}
            {(project.startDate || project.targetDate) && (
              <>
                {" · "}
                {formatDate(project.startDate)} →{" "}
                <span className={targetOverdue ? "text-destructive font-medium" : undefined}>
                  {formatDate(project.targetDate)}
                  {targetOverdue && " (past target)"}
                </span>
              </>
            )}
          </>
        }
      >
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

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              {latestUpdate ? `Last update ${formatDate(latestUpdate.date)}` : "No updates yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="font-heading text-4xl font-semibold tabular-nums">{project.progressPercent}%</p>
            <Progress value={project.progressPercent} className="h-2" aria-label="Project progress" />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            {project.description ? (
              <p className="leading-relaxed whitespace-pre-wrap">{project.description}</p>
            ) : (
              <p className="text-muted-foreground">No description yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* Side column first in the DOM so it follows the summary on mobile. */}
        <div className="grid gap-6 lg:order-last">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> Members
                <span className="text-muted-foreground font-normal tabular-nums">({project.members.length})</span>
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
                <p className="text-muted-foreground">No members assigned yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {project.members.map(({ member, roleInProject }) => (
                    <li key={member.id} className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <Link href={`/members/${member.id}`} className="block truncate font-medium hover:underline">
                          {member.name}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">
                          {roleInProject} · {DESIGNATION_LABELS[member.designation]}
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
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="size-4" /> Tech stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              {techGroups.length === 0 ? (
                <EmptyState
                  title="No tech stack listed"
                  description={admin ? "Edit the project to add languages, frameworks and hardware." : undefined}
                />
              ) : (
                <dl className="grid gap-3">
                  {techGroups.map((k) => (
                    <div key={k} className="grid gap-1.5">
                      <dt className="text-muted-foreground text-xs font-medium">{TECH_STACK_LABELS[k]}</dt>
                      <dd className="flex flex-wrap gap-1">
                        {techStack[k].map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid min-w-0 gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="size-4" /> Required components
              </CardTitle>
              <CardDescription>Issued = units currently checked out for this project.</CardDescription>
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
            <CardContent>
              {requirements.length === 0 ? (
                <EmptyState icon={Cpu} title="No components required yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Issued</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">In stock</TableHead>
                      <TableHead>Status</TableHead>
                      {admin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((r) => (
                      <TableRow key={r.componentId}>
                        <TableCell className="min-w-36 font-medium whitespace-normal">
                          <Link href={`/inventory/${r.componentId}`} className="hover:underline">
                            {r.component.name}
                          </Link>
                          {r.component.modelNumber && (
                            <span className="text-muted-foreground block text-xs">{r.component.modelNumber}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantityRequired}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.quantityIssued}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.available}</TableCell>
                        <TableCell>
                          {r.need <= 0 ? (
                            <ToneBadge tone="green">Fully issued</ToneBadge>
                          ) : (
                            <ToneBadge tone={r.available < r.need ? "red" : "amber"}>
                              Need {r.need} more
                              {r.available < r.need && <span className="sr-only">, only {r.available} in stock</span>}
                            </ToneBadge>
                          )}
                        </TableCell>
                        {admin && (
                          <TableCell>
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
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Edit ${r.component.name} quantity`}
                                  >
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

          {project.issuances.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageOpen className="size-4" /> Checked out for this project
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead className="hidden sm:table-cell">Due</TableHead>
                      <TableHead>Status</TableHead>
                      {admin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.issuances.map((iss) => (
                      <TableRow key={iss.id}>
                        <TableCell className="min-w-36 font-medium whitespace-normal">
                          <Link href={`/inventory/${iss.component.id}`} className="hover:underline">
                            {iss.component.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{iss.quantity}</TableCell>
                        <TableCell>
                          <Link href={`/members/${iss.issuedTo.id}`} className="hover:underline">
                            {iss.issuedTo.name}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{formatDate(iss.expectedReturnDate)}</TableCell>
                        <TableCell>
                          <IssuanceStatusBadge
                            returned={false}
                            overdueDays={isOverdue(iss) && iss.expectedReturnDate ? daysOverdue(iss.expectedReturnDate) : 0}
                          />
                        </TableCell>
                        {admin && (
                          <TableCell className="text-right">
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
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" /> Progress timeline
              </CardTitle>
              <CardDescription>Newest first. Project progress follows the latest update.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {options && (
                <ProgressUpdateForm
                  projectId={project.id}
                  today={toDateInput(todayNoonUTC())}
                  currentPercent={project.progressPercent}
                  projectMembers={project.members.map((m) => m.member)}
                  otherMembers={memberCandidates}
                />
              )}
              {project.progressUpdates.length === 0 ? (
                <EmptyState icon={History} title="No progress updates yet" />
              ) : (
                <ol className="border-border ms-2 grid gap-6 border-s">
                  {project.progressUpdates.map((u) => (
                    <li key={u.id} className="relative ps-5">
                      <span
                        aria-hidden
                        className="bg-primary ring-card absolute top-1 -start-[5px] size-2.5 rounded-full ring-4"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <time dateTime={toDateInput(u.date)} className="text-sm font-medium">
                          {formatDate(u.date)}
                        </time>
                        <ToneBadge tone="blue" className="tabular-nums">
                          {u.percentAtUpdate}%
                        </ToneBadge>
                        {admin && (
                          <span className="ms-auto">
                            <DeleteUpdateButton id={u.id} />
                          </span>
                        )}
                      </div>
                      <p className="mt-1 leading-relaxed whitespace-pre-wrap">{u.note}</p>
                      {u.updatedBy && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          by{" "}
                          <Link href={`/members/${u.updatedBy.id}`} className="hover:underline">
                            {u.updatedBy.name}
                          </Link>
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
