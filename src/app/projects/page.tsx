import type { Metadata } from "next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { ProjectFormDialog } from "@/components/projects/project-form"
import { ProjectList, type ProjectCardData, type View } from "@/components/projects/project-list"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/auth"
import { toDateInput, todayNoonUTC } from "@/lib/dates"
import { STATUSES, parseTechStack } from "@/lib/labels"
import type { ProjectStatus } from "@prisma/client"

export const metadata: Metadata = { title: "Projects" }

const VIEWS: View[] = ["grid", "board", "roadmap"]

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const { view: viewParam, status: statusParam, new: newParam } = await props.searchParams
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : "grid"
  // Deep links: the dashboard's "N projects moving" (?status=IN_PROGRESS), ⌘K "New project" (?new=1).
  const status = STATUSES.includes(statusParam as ProjectStatus) ? (statusParam as ProjectStatus) : "all"

  const [rows, teams, admin] = await Promise.all([
    db.project.findMany({
      include: {
        team: { select: { id: true, name: true } },
        _count: { select: { members: true } },
        progressUpdates: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
        components: { select: { quantityRequired: true, quantityIssued: true } },
        tasks: { select: { status: true, dueDate: true } },
      },
    }),
    db.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    isAdmin(),
  ])

  const today = todayNoonUTC()
  const projects: ProjectCardData[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    progressPercent: p.progressPercent,
    startDate: p.startDate,
    targetDate: p.targetDate,
    targetOverdue:
      !!p.targetDate && p.targetDate < today && p.status !== "COMPLETED" && p.status !== "DROPPED",
    team: p.team,
    memberCount: p._count.members,
    lastUpdate: p.progressUpdates[0]?.date ?? null,
    techStack: parseTechStack(p.techStack),
    componentCount: p.components.length,
    unitsRequired: p.components.reduce((n, c) => n + c.quantityRequired, 0),
    unitsIssued: p.components.reduce((n, c) => n + c.quantityIssued, 0),
    tasks: {
      total: p.tasks.length,
      done: p.tasks.filter((t) => t.status === "DONE").length,
      overdue: p.tasks.filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate < today).length,
    },
  }))

  const active = projects.filter((p) => p.status === "IN_PROGRESS").length
  const late = projects.filter((p) => p.targetOverdue).length

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow="Work · Projects"
        title="Projects"
        description={
          <>
            What the club is building, who is on it and how far along it is.{" "}
            <span className="text-foreground">
              {active} in progress
              {late > 0 && (
                <>
                  {" · "}
                  <span className="text-danger font-medium">{late} past target</span>
                </>
              )}
            </span>
          </>
        }
      >
        {admin && (
          <ProjectFormDialog
            teams={teams}
            defaultOpen={newParam === "1"}
            trigger={
              <Button variant="brand">
                <Plus /> New project
              </Button>
            }
          />
        )}
      </PageHeader>
      <ProjectList
        projects={projects}
        teams={teams}
        initialView={view}
        initialStatus={status}
        today={toDateInput(today)}
      />
    </div>
  )
}
