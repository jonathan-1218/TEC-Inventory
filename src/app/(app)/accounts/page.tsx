import type { Metadata } from "next"
import Link from "next/link"
import { GraduationCap, Inbox, KeyRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { db } from "@/lib/db"
import { getDesignations, TIER_LABELS } from "@/lib/designations"
import { isAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { storedSignupSchema } from "@/lib/validators"
import { GoalDialog } from "@/components/projects/goal-dialog"
import { getClubGoal } from "@/lib/goals"
import { toDateInput } from "@/lib/dates"
import { DesignationDialog } from "@/components/designation-dialog"
import { ApproveButtons, MentorDialog, RemoveDesignation, RemoveLogin, RemoveMentor, ResetPassword } from "./controls"

export const metadata: Metadata = { title: "Sign-ups, mentors & goals" }

export default async function AccountsPage() {
  if (!(await isAdmin())) {
    return <EmptyState icon={KeyRound} title="Admins only" description="Log in as a club admin to review sign-ups." />
  }
  const [accounts, mentors, club, designations, roleUse] = await Promise.all([
    db.account.findMany({
      select: { id: true, email: true, signup: true, approvedAt: true, createdAt: true, project: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.mentor.findMany({ include: { _count: { select: { projects: true } } }, orderBy: { name: "asc" } }),
    getClubGoal(),
    getDesignations(),
    db.member.groupBy({ by: ["designation"], _count: true }),
  ])
  const usedBy = new Map(roleUse.map((r) => [r.designation, r._count]))
  const mentorName = new Map(mentors.map((m) => [m.id, `${m.name} · ${m.designation}`]))
  const pending = accounts.filter((a) => !a.approvedAt)
  const approved = accounts.filter((a) => a.approvedAt)

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow="People · Admin"
        title="Sign-ups, mentors & goals"
        description={
          <span className="font-mono text-xs tabular-nums">
            {pending.length} waiting · {approved.length} team logins · {mentors.length} mentors
          </span>
        }
      />

      <Card>
        <CardHeader>
          <p className="eyebrow">Club-wide goal</p>
          <CardTitle>
            {club?.goalPercent != null && club.goalDate
              ? `Every project should reach ${club.goalPercent}% by ${formatDate(club.goalDate)}`
              : "No club-wide goal set"}
          </CardTitle>
          <CardDescription>
            Applies to every project without its own goal (set those on the project page). Projects more than 10 points behind a
            steady pace are flagged on the dashboard, the project page and the team&apos;s page.
          </CardDescription>
          <div className="pt-2">
            <GoalDialog
              current={{ percent: club?.goalPercent ?? null, date: club?.goalDate ? toDateInput(club.goalDate) : null }}
              label={club?.goalPercent != null ? "Change club goal" : "Set club goal"}
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <p className="eyebrow">Waiting for approval</p>
          <CardTitle>New project sign-ups</CardTitle>
          <CardDescription>Approving creates the project and adds its members (existing register numbers are reused).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {pending.length === 0 ? (
            <EmptyState icon={Inbox} title="No sign-ups waiting" />
          ) : (
            pending.map((a) => {
              const s = storedSignupSchema.safeParse(a.signup)
              if (!s.success) return null
              return (
                <div key={a.id} className="grid gap-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.data.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {s.data.kind === "GROUP" ? `Group · ${s.data.members.length} members` : "Individual"} · {a.email} · sent{" "}
                        {formatDate(a.createdAt)}
                      </p>
                      <p className="mt-1 text-sm">
                        Team: {s.data.teamName ?? `${s.data.title} team`} · Mentor: {mentorName.get(s.data.mentorId) ?? <span className="text-danger">removed from the list</span>}
                      </p>
                      {s.data.description && <p className="text-muted-foreground mt-1 text-sm">{s.data.description}</p>}
                    </div>
                    <ApproveButtons id={a.id} title={s.data.title} />
                  </div>
                  <ul className="grid gap-1 text-sm">
                    {s.data.members.map((m, i) => (
                      <li key={m.rollNumber} className="flex flex-wrap gap-x-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground font-mono text-xs leading-5">{m.rollNumber}</span>
                        <span className="text-muted-foreground text-xs leading-5">
                          {m.department} · year {m.yearOfStudy}
                        </span>
                        {i === 0 && <Badge variant="outline">Lead</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <p className="eyebrow">Designations</p>
          <CardTitle>Roles you can give a member</CardTitle>
          <CardDescription>
            Add your own, rename them or change their order. Office bearers appear as cards on the Members page; a designation can only be removed when no member has it.
          </CardDescription>
          <div className="pt-2">
            <DesignationDialog nextRank={(designations.at(-1)?.rank ?? 0) + 10} />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <ul>
            {designations.map((d) => (
              <li key={d.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                <span className="text-muted-foreground w-10 font-mono text-xs tabular-nums">{d.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.label}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {TIER_LABELS[d.tier]} · {usedBy.get(d.id) ?? 0} {(usedBy.get(d.id) ?? 0) === 1 ? "member" : "members"}
                  </p>
                </div>
                <DesignationDialog designation={d} nextRank={d.rank} />
                {d.id !== "MEMBER" && <RemoveDesignation id={d.id} label={d.label} />}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <p className="eyebrow">Mentors</p>
            <CardTitle>Mentor list</CardTitle>
            <CardDescription>Teams pick their mentor from this list when they sign up.</CardDescription>
            <div className="pt-2">
              <MentorDialog />
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {mentors.length === 0 ? (
              <div className="px-4">
                <EmptyState icon={GraduationCap} title="No mentors yet" description="Add one so teams can sign up." />
              </div>
            ) : (
              <ul>
                {mentors.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {m.designation}
                        {m.department && ` · ${m.department}`} · {m._count.projects} projects
                      </p>
                    </div>
                    <MentorDialog mentor={{ id: m.id, name: m.name, designation: m.designation, department: m.department }} />
                    <RemoveMentor id={m.id} name={m.name} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <p className="eyebrow">Approved</p>
            <CardTitle>Team logins</CardTitle>
            <CardDescription>Removing a login keeps the project; the team just can&apos;t edit it any more.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {approved.length === 0 ? (
              <div className="px-4">
                <EmptyState icon={KeyRound} title="No team logins yet" />
              </div>
            ) : (
              <ul>
                {approved.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.project ? (
                          <Link href={`/projects/${a.project.id}`} className="hover:text-brand-strong">
                            {a.project.title}
                          </Link>
                        ) : (
                          "Project deleted"
                        )}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {a.email} · approved {formatDate(a.approvedAt)}
                      </p>
                    </div>
                    <ResetPassword id={a.id} email={a.email} />
                    <RemoveLogin id={a.id} email={a.email} />
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
