import type { Metadata } from "next"
import { Info, ShieldCheck } from "lucide-react"
import { ChangePassword } from "@/components/portal/change-password"
import { MembersSection, ProjectSection, TeamSection } from "@/components/portal/settings-forms"
import { db } from "@/lib/db"
import { formatDate, toDateInput } from "@/lib/dates"
import { getClubGoal, goalFor } from "@/lib/goals"
import { parseTechStack } from "@/lib/labels"
import { requireTeam } from "@/lib/portal"

export const metadata: Metadata = { title: "Team settings" }

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-2xl border p-6 sm:p-7">
      <div className="mb-5">
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        {description && <p className="text-muted-foreground mt-1 text-sm text-pretty">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default async function TeamSettingsPage() {
  const team = await requireTeam()
  const [project, club] = await Promise.all([
    db.project.findUnique({
      where: { id: team.projectId },
      select: {
        title: true, description: true, status: true, startDate: true, targetDate: true, techStack: true, createdAt: true,
        goalPercent: true, goalDate: true,
        team: { select: { name: true, description: true } },
        mentor: { select: { name: true, designation: true, department: true } },
        members: { select: { roleInProject: true, member: { select: { id: true, name: true } } }, orderBy: { member: { name: "asc" } } },
      },
    }),
    getClubGoal(),
  ])
  if (!project) return null
  const goal = goalFor(project, club)

  return (
    <div className="grid gap-8">
      <div>
        <p className="eyebrow mb-2">{project.title}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Everything about your project and team that you can change.</p>
      </div>

      <ProjectSection
        projectId={team.projectId}
        project={{
          title: project.title,
          description: project.description ?? "",
          status: project.status,
          startDate: project.startDate ? toDateInput(project.startDate) : "",
          targetDate: project.targetDate ? toDateInput(project.targetDate) : "",
          techStack: parseTechStack(project.techStack),
        }}
      />

      {project.team && <TeamSection projectId={team.projectId} team={{ name: project.team.name, description: project.team.description ?? "" }} />}

      <MembersSection
        projectId={team.projectId}
        members={project.members.map((m) => ({ id: m.member.id, name: m.member.name, role: m.roleInProject, isLead: /lead/i.test(m.roleInProject) }))}
      />

      <Section title="Account and security">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="size-4" /> Login email
            </p>
            <p className="font-mono">{team.email}</p>
            <p className="text-muted-foreground text-xs">Everyone on your team shares this login.</p>
          </div>
          <ChangePassword />
        </div>
      </Section>

      <Section title="Set by the club" description="These are managed by the club admins, so they can't be changed here.">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="eyebrow mb-1">Mentor</dt>
            <dd>{project.mentor ? `${project.mentor.name}${project.mentor.designation ? `, ${project.mentor.designation}` : ""}` : "Not assigned"}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Progress goal</dt>
            <dd>{goal ? `${goal.percent}% by ${formatDate(goal.date)}${goal.source === "club" ? " (club-wide)" : ""}` : "No goal set"}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-1">Registered</dt>
            <dd>{formatDate(project.createdAt)}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground mt-5 flex items-start gap-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Progress is set by the updates you post on the Progress page, not here.
        </p>
      </Section>
    </div>
  )
}
