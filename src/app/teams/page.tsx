import type { Metadata } from "next"
import { Plus, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { TeamCard, type TeamCardData } from "@/components/teams/team-card"
import { TeamDialog } from "@/components/teams/team-dialog"
import { getTeamSnapshot } from "@/lib/analytics"
import { isAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Teams" }

const isLead = (role: string) => role.trim().toLowerCase() === "team lead"

export default async function TeamsPage() {
  const [admin, teams, activeMembers, snapshot] = await Promise.all([
    isAdmin(),
    db.team.findMany({
      orderBy: { name: "asc" },
      include: {
        members: {
          select: {
            roleInTeam: true,
            member: {
              select: {
                id: true,
                name: true,
                designation: true,
                isActive: true,
              },
            },
          },
        },
        projects: {
          select: {
            id: true,
            title: true,
            status: true,
            progressPercent: true,
          },
          orderBy: { title: "asc" },
        },
      },
    }),
    db.member.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, rollNumber: true },
    }),
    getTeamSnapshot(),
  ])

  const cards: TeamCardData[] = teams.map((t) => {
    const snap = snapshot.find((s) => s.id === t.id)
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      projects: t.projects,
      members: t.members
        .map(({ roleInTeam, member }) => ({
          ...member,
          roleInTeam,
          isLead: isLead(roleInTeam),
        }))
        // Team Lead first, then alphabetical.
        .sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.name.localeCompare(b.name)),
      stats: {
        activeProjects: snap?.activeProjects ?? 0,
        openTasks: snap?.openTasks ?? 0,
        unitsOnLoan: snap?.unitsOnLoan ?? 0,
      },
    }
  })

  const newTeam = admin && (
    <TeamDialog
      trigger={
        <Button variant="brand">
          <Plus /> New team
        </Button>
      }
    />
  )

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow="Work · Teams"
        title="Teams"
        description="Who works together, their roles, and what they're building."
      >
        {newTeam}
      </PageHeader>
      {cards.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No teams yet"
          description="Create a team to group members and the projects they work on."
        >
          {newTeam}
        </EmptyState>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {cards.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              candidates={activeMembers.filter((m) => !team.members.some((tm) => tm.id === m.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
