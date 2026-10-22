import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { TaskTracker, type TrackerFilters, type TrackerProject } from "@/components/tasks/task-tracker"
import type { TaskItem } from "@/components/tasks/task-parts"
import { db } from "@/lib/db"
import { toDateInput, todayNoonUTC } from "@/lib/dates"

export const metadata: Metadata = { title: "Tasks" }

const DAY = 86_400_000
const pick = <T extends string>(v: string | string[] | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

export default async function TasksPage(props: PageProps<"/tasks">) {
  const sp = await props.searchParams
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "")

  const todayDate = todayNoonUTC()
  const [rows, projects, weekDone] = await Promise.all([
    db.task.findMany({
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.project.findMany({
      select: { id: true, title: true, status: true, progressPercent: true, team: { select: { id: true, name: true } } },
      orderBy: { title: "asc" },
    }),
    // "Shipped this week": completed in the last 7 days (completedAt is a real timestamp).
    db.task.count({ where: { completedAt: { gte: new Date(todayDate.getTime() - 7 * DAY) } } }),
  ])

  const tasks: TaskItem[] = rows.map((t) => ({
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
  const trackerProjects: TrackerProject[] = projects.filter((p) => rows.some((t) => t.projectId === p.id))

  const filters: TrackerFilters = {
    q: str(sp.q),
    status: pick(str(sp.status), ["open", "TODO", "IN_PROGRESS", "DONE", "all"] as const, "open"),
    assignee: str(sp.assignee) || "all",
    project: str(sp.project) || "all",
    due: pick(str(sp.due), ["any", "overdue", "week", "none"] as const, "any"),
    group: pick(str(sp.group), ["project", "assignee"] as const, "project"),
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow="Work · Tasks"
        title="Tasks"
        description="Every task across the club's projects: who's on what, what's late and what's next."
      />
      <TaskTracker
        tasks={tasks}
        projects={trackerProjects}
        today={toDateInput(todayDate)}
        doneThisWeek={weekDone}
        initial={filters}
      />
    </div>
  )
}
