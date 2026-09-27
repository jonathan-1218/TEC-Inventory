import type { Metadata } from "next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { ProjectFormDialog } from "@/components/projects/project-form"
import { ProjectList, type ProjectCardData } from "@/components/projects/project-list"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/auth"
import { todayNoonUTC } from "@/lib/dates"
import { parseTechStack } from "@/lib/labels"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const [rows, teams, admin] = await Promise.all([
    db.project.findMany({
      include: {
        team: { select: { id: true, name: true } },
        _count: { select: { members: true } },
        progressUpdates: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
        components: { select: { quantityRequired: true, quantityIssued: true } },
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
  }))

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Projects" description="What the club is building, who is on it and how far along it is.">
        {admin && (
          <ProjectFormDialog
            teams={teams}
            trigger={
              <Button>
                <Plus /> New project
              </Button>
            }
          />
        )}
      </PageHeader>
      <ProjectList projects={projects} teams={teams} />
    </div>
  )
}
