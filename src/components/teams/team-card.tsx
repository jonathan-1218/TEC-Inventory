"use client"

import { useState } from "react"
import Link from "next/link"
import type { Designation, ProjectStatus } from "@prisma/client"
import { ArrowRight, Crown, MoreHorizontal, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useIsAdmin } from "@/components/admin-context"
import { ProjectStatusBadge, ToneBadge } from "@/components/badges"
import { ProgressRing } from "@/components/charts"
import { ConfirmDelete } from "@/components/confirm-delete"
import { TeamDialog } from "@/components/teams/team-dialog"
import { TeamMemberDialog } from "@/components/teams/team-member-dialog"
import { deleteTeam, removeTeamMember } from "@/app/actions/teams"
import { DESIGNATION_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"

export type TeamMemberData = {
  id: string
  name: string
  designation: Designation
  isActive: boolean
  roleInTeam: string
  isLead: boolean
}

export type TeamCardData = {
  id: string
  name: string
  description: string | null
  members: TeamMemberData[]
  projects: { id: string; title: string; status: ProjectStatus; progressPercent: number }[]
  stats: { activeProjects: number; openTasks: number; unitsOnLoan: number }
}

type Candidate = { id: string; name: string; rollNumber: string }

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

export function TeamCard({
  team,
  candidates,
}: {
  team: TeamCardData
  /** Active members not yet on this team. */
  candidates: Candidate[]
}) {
  const isAdmin = useIsAdmin()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const stats = [
    { label: "Members", value: team.members.length },
    { label: "Active", value: team.stats.activeProjects },
    { label: "Open tasks", value: team.stats.openTasks },
    { label: "Units on loan", value: team.stats.unitsOnLoan },
  ]

  return (
    // :target highlights the card when opened via /teams#<id>.
    <Card id={team.id} className="scroll-mt-20 transition-shadow target:ring-2 target:ring-brand">
      <CardHeader>
        <p className="eyebrow">Team</p>
        <CardTitle className="text-lg">
          <h2>
            <Link href={`/teams/${team.id}`} className="hover:text-brand-strong">
              {team.name}
            </Link>
          </h2>
        </CardTitle>
        {team.description && <CardDescription>{team.description}</CardDescription>}
        {isAdmin && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${team.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Edit team
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 /> Delete team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Rendered outside the menu so it survives the menu closing. */}
            <TeamDialog team={team} open={editOpen} onOpenChange={setEditOpen} />
            <ConfirmDelete
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title={`Delete ${team.name}?`}
              description="Projects in this team will become team-less; members are not deleted."
              successMessage="Team deleted"
              onConfirm={() => deleteTeam({ id: team.id })}
            />
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="grid gap-5">
        <dl className="grid grid-cols-2 rounded-lg border sm:grid-cols-4 sm:divide-x max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-child(-n+2)]:border-b">
          {stats.map((s) => (
            <div key={s.label} className="grid gap-0.5 px-3 py-2.5">
              <dt className="eyebrow text-[10px]">{s.label}</dt>
              <dd className="font-display text-xl font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <section className="grid gap-2">
          <h3 className="eyebrow">Projects</h3>
          {team.projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">No projects yet.</p>
          ) : (
            <ul className="grid gap-1">
              {team.projects.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-1">
                  <ProgressRing value={p.progressPercent} size="sm" label={`${p.title} progress`} />
                  <Link href={`/projects/${p.id}`} className="hover:text-brand-strong min-w-0 flex-1 truncate text-sm font-medium">
                    {p.title}
                  </Link>
                  <ProjectStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="eyebrow">Members</h3>
            {isAdmin && <AddTeamMember teamId={team.id} teamName={team.name} candidates={candidates} />}
          </div>
          <TeamMemberList team={team} members={team.members} />
        </section>

        <Button variant="ghost" size="sm" asChild className="-ms-2 w-fit">
          <Link href={`/teams/${team.id}`}>
            Tasks, loans and activity <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function AddTeamMember({
  teamId,
  teamName,
  candidates,
  variant = "outline",
}: {
  teamId: string
  teamName: string
  candidates: Candidate[]
  variant?: "outline" | "brand"
}) {
  return candidates.length > 0 ? (
    <TeamMemberDialog
      teamId={teamId}
      teamName={teamName}
      candidates={candidates}
      trigger={
        <Button variant={variant} size={variant === "brand" ? "default" : "xs"}>
          <UserPlus /> Add member
        </Button>
      }
    />
  ) : (
    <span className="text-muted-foreground text-xs">Every active member is on this team</span>
  )
}

/** Members with their team role (lead first); admins can change roles or remove people. */
export function TeamMemberList({
  team,
  members,
  notes,
}: {
  team: { id: string; name: string }
  members: TeamMemberData[]
  /** Extra text per member id, e.g. "3 open tasks" on the team detail page. */
  notes?: Record<string, string>
}) {
  const isAdmin = useIsAdmin()
  if (members.length === 0) return <p className="text-muted-foreground text-sm">No members yet.</p>
  return (
    <ul className="grid gap-1">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-md py-1">
          <span
            aria-hidden
            className={cn(
              "bg-muted text-muted-foreground ring-border grid size-8 shrink-0 place-items-center rounded-md font-mono text-xs ring-1",
              m.isLead && "bg-foreground text-background ring-foreground",
              !m.isActive && "opacity-50"
            )}
          >
            {initials(m.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Link
                href={`/members/${m.id}`}
                className={cn("hover:text-brand-strong truncate text-sm font-medium", !m.isActive && "text-muted-foreground")}
              >
                {m.name}
              </Link>
              {m.isLead ? (
                <ToneBadge tone="ink" className="max-w-full">
                  <Crown aria-hidden />
                  <span className="truncate">{m.roleInTeam}</span>
                </ToneBadge>
              ) : (
                <ToneBadge tone="neutral" className="text-muted-foreground max-w-full border-border">
                  <span className="truncate">{m.roleInTeam}</span>
                </ToneBadge>
              )}
              {!m.isActive && <ToneBadge tone="muted">Inactive</ToneBadge>}
            </div>
            <p className="text-muted-foreground truncate text-xs">
              {DESIGNATION_LABELS[m.designation]}
              {notes?.[m.id] && ` · ${notes[m.id]}`}
            </p>
          </div>
          {isAdmin && (
            <div className="flex shrink-0 items-center">
              <TeamMemberDialog
                teamId={team.id}
                teamName={team.name}
                member={m}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Change role for ${m.name}`}>
                    <Pencil />
                  </Button>
                }
              />
              <ConfirmDelete
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name} from ${team.name}`}>
                    <UserMinus />
                  </Button>
                }
                title={`Remove ${m.name} from team?`}
                description={`${m.name} stays in the club; only their place on ${team.name} is removed.`}
                confirmLabel="Remove"
                successMessage="Removed from team"
                onConfirm={() => removeTeamMember({ teamId: team.id, memberId: m.id })}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
