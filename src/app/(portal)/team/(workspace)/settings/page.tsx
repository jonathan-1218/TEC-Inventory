import type { Metadata } from "next"
import { ChangePassword } from "@/components/portal/change-password"
import { MembersSection, ProjectSection, TeamSection } from "@/components/portal/settings-forms"
import { StackPanel } from "@/components/ui/stack-panel"
import { db } from "@/lib/db"
import { formatDate, toDateInput } from "@/lib/dates"
import { getClubGoal, goalFor } from "@/lib/goals"
import { parseTechStack } from "@/lib/labels"
import { requireTeam } from "@/lib/portal"

export const metadata: Metadata = { title: "Team settings" }

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

  const pages = {
    settings: {
      title: "Settings",
      sections: [
        {
          rows: [
            { id: "project", label: "Project", detail: project.title, to: "project" },
            ...(project.team ? [{ id: "team", label: "Team", detail: project.team.name, to: "team" }] : []),
            { id: "members", label: "Members", detail: `${project.members.length} ${project.members.length === 1 ? "person" : "people"}`, to: "members" },
          ],
        },
        { rows: [{ id: "account", label: "Account and security", detail: team.email, to: "account" }] },
        {
          title: "Set by the club",
          rows: [
            {
              id: "mentor",
              label: "Mentor",
              detail: project.mentor ? `${project.mentor.name}${project.mentor.designation ? `, ${project.mentor.designation}` : ""}` : "Not assigned",
            },
            {
              id: "goal",
              label: "Progress goal",
              detail: goal ? `${goal.percent}% by ${formatDate(goal.date)}${goal.source === "club" ? " (club-wide)" : ""}` : "No goal set",
            },
            { id: "registered", label: "Registered", detail: formatDate(project.createdAt) },
          ],
          footer: "Managed by the club admins. Progress comes from the updates you post on the Progress page.",
        },
      ],
    },
    project: {
      title: "Project",
      body: (
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
      ),
    },
    ...(project.team && {
      team: { title: "Team", body: <TeamSection projectId={team.projectId} team={{ name: project.team.name, description: project.team.description ?? "" }} /> },
    }),
    members: {
      title: "Members",
      body: (
        <MembersSection
          projectId={team.projectId}
          members={project.members.map((m) => ({ id: m.member.id, name: m.member.name, role: m.roleInProject, isLead: /lead/i.test(m.roleInProject) }))}
        />
      ),
    },
    account: {
      title: "Account and security",
      sections: [{ rows: [{ id: "email", label: "Login email", detail: team.email }], footer: "Everyone on your team shares this login." }],
      body: (
        <div className="px-3">
          <ChangePassword />
        </div>
      ),
    },
  }

  return (
    <div className="grid gap-8">
      <div>
        <p className="eyebrow mb-2">{project.title}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Everything about your project and team that you can change.</p>
      </div>
      <StackPanel pages={pages} root="settings" className="max-w-2xl" />
    </div>
  )
}
