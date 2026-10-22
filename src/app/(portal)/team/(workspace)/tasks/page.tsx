import type { Metadata } from "next"
import { ProjectTasks } from "@/components/tasks/project-tasks"
import { db } from "@/lib/db"
import { toDateInput, todayNoonUTC } from "@/lib/dates"
import { requireTeam } from "@/lib/portal"

export const metadata: Metadata = { title: "Team tasks" }

export default async function TeamTasksPage() {
  const { projectId } = await requireTeam()
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      members: { select: { member: { select: { id: true, name: true } } }, orderBy: { member: { name: "asc" } } },
      tasks: { include: { assignee: { select: { id: true, name: true } } }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  })
  if (!project) return null
  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow mb-2">{project.title}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground mt-1 text-sm">Plan the work, drag cards between columns, and tick things off as you go.</p>
      </div>
      <ProjectTasks
        projectId={projectId}
        tasks={project.tasks.map((t) => ({
          id: t.id, projectId: t.projectId, title: t.title, description: t.description, status: t.status,
          priority: t.priority, dueDate: t.dueDate, assignee: t.assignee,
        }))}
        today={toDateInput(todayNoonUTC())}
        projectMembers={project.members.map((m) => m.member)}
        otherMembers={[]}
      />
    </div>
  )
}
