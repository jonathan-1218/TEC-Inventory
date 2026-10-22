"use client"

import { useState } from "react"
import Link from "next/link"
import type { ProjectStatus } from "@prisma/client"
import { ArrowRight, Crown, MoreHorizontal, Pencil, Trash2, UserMinus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { useDesignations } from "@/components/designations-context"
import { cn } from "@/lib/utils"

export type TeamMemberData = {
  id: string
  name: string
  designation: string
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

const MAX_PROJECTS = 2
const MAX_AVATARS = 5

/**
 * One tile in the teams grid. Every tile has the same anatomy and (the grid stretches them) the same height:
 * a progress strip along the top, monogram + name, four readouts, up to two projects, and a footer with the
 * member avatars pinned to the bottom. Roles, adding and removing people live on the team's own page.
 */
export function TeamCard({
  team,
}: {
  team: TeamCardData
  /** Kept for the grid's call site; member management happens on the team page. */
  candidates?: Candidate[]
}) {
  const isAdmin = useIsAdmin()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const stats = [
    { label: "Members", value: team.members.length },
    { label: "Active", value: team.stats.activeProjects },
    { label: "Tasks", value: team.stats.openTasks },
    { label: "On loan", value: team.stats.unitsOnLoan },
  ]
  const progress = team.projects.length
    ? Math.round(team.projects.reduce((n, p) => n + p.progressPercent, 0) / team.projects.length)
    : 0
  const lead = team.members.find((m) => m.isLead)
  const shown = team.projects.slice(0, MAX_PROJECTS)
  const hiddenProjects = team.projects.length - shown.length

  return (
    // :target highlights the card when opened via /teams#<id>.
    <Card
      id={team.id}
      className="group/team relative h-full scroll-mt-20 [--card-spacing:--spacing(6)] transition-[translate,box-shadow] duration-300 hover:ring-foreground/25 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_22px_36px_-16px_rgb(20_19_15/0.38),0_8px_14px_-8px_rgb(20_19_15/0.22)] dark:motion-safe:hover:shadow-[0_16px_30px_-18px_rgb(233_151_4/0.55)] motion-safe:active:scale-[0.995] target:ring-2 target:ring-brand"
    >
      {/* Team's average progress, drawn as a strip along the top edge. */}
      <div aria-hidden className="bg-muted absolute inset-x-0 top-0 h-1">
        <div className="bg-brand h-full" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center gap-4 px-(--card-spacing) pt-1">
        <span
          aria-hidden
          className="bg-foreground text-background font-display grid size-12 shrink-0 place-items-center rounded-xl text-xl font-extrabold"
        >
          {team.name.trim()[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Team · {progress}% avg</p>
          <h2 className="font-heading truncate text-lg leading-snug font-semibold tracking-tight">
            <Link href={`/teams/${team.id}`} className="hover:text-brand-strong">
              {team.name}
            </Link>
          </h2>
        </div>
        {isAdmin && (
          <div className="shrink-0">
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
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-5">
        <p className="text-muted-foreground line-clamp-2 md:min-h-10 text-sm text-pretty">
          {team.description ?? (lead ? `Led by ${lead.name}.` : "No description yet.")}
        </p>

        <dl className="bg-muted/50 grid grid-cols-4 divide-x rounded-xl py-3">
          {stats.map((st) => (
            <div key={st.label} className="grid justify-items-center gap-0.5 px-1">
              <dd className="font-display text-2xl leading-none font-bold tabular-nums">{st.value}</dd>
              <dt className="eyebrow text-center text-[11px] tracking-[0.06em]">{st.label}</dt>
            </div>
          ))}
        </dl>

        {/* Fixed height for two rows, so tiles with fewer projects stay the same size. */}
        <ul className="grid content-start gap-2 md:min-h-[5.5rem]">
          {shown.length === 0 && <li className="text-muted-foreground text-sm">No projects yet.</li>}
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <ProgressRing value={p.progressPercent} size="sm" label={`${p.title} progress`} />
              <Link href={`/projects/${p.id}`} className="hover:text-brand-strong min-w-0 flex-1 truncate text-sm font-medium">
                {p.title}
              </Link>
              <ProjectStatusBadge status={p.status} />
            </li>
          ))}
          {hiddenProjects > 0 && <li className="text-muted-foreground text-xs">+{hiddenProjects} more on the team page</li>}
        </ul>

        {/* Pinned to the bottom of every tile. */}
        <div className="mt-auto flex items-center gap-3 border-t pt-4">
          <ul className="flex -space-x-1.5" aria-label={`${team.members.length} members`}>
            {team.members.slice(0, MAX_AVATARS).map((m) => (
              <li
                key={m.id}
                title={`${m.name}${m.isLead ? " · lead" : ""}`}
                className={cn(
                  "ring-card grid size-8 place-items-center rounded-full font-mono text-[11px] ring-2",
                  m.isLead ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                  !m.isActive && "opacity-50"
                )}
              >
                {initials(m.name)}
              </li>
            ))}
            {team.members.length > MAX_AVATARS && (
              <li className="bg-card text-muted-foreground ring-card grid size-8 place-items-center rounded-full font-mono text-[11px] ring-2 outline outline-border">
                +{team.members.length - MAX_AVATARS}
              </li>
            )}
          </ul>
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
            {lead ? (
              <>
                Led by <span className="text-foreground font-medium">{lead.name}</span>
              </>
            ) : (
              "No team lead"
            )}
          </p>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/teams/${team.id}`} aria-label={`Open ${team.name}`}>
              <ArrowRight />
            </Link>
          </Button>
        </div>
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
  const roles = useDesignations()
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
              {roles.label(m.designation)}
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
