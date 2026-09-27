"use client"

import { useState } from "react"
import Link from "next/link"
import type { Designation, ProjectStatus } from "@prisma/client"
import { Crown, FolderKanban, MoreHorizontal, Pencil, Trash2, UserMinus, UserPlus, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useIsAdmin } from "@/components/admin-context"
import { ProjectStatusBadge, ToneBadge } from "@/components/badges"
import { ConfirmDelete } from "@/components/confirm-delete"
import { TeamDialog } from "@/components/teams/team-dialog"
import { TeamMemberDialog } from "@/components/teams/team-member-dialog"
import { deleteTeam, removeTeamMember } from "@/app/actions/teams"
import { DESIGNATION_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"

export type TeamCardData = {
  id: string
  name: string
  description: string | null
  members: {
    id: string
    name: string
    designation: Designation
    isActive: boolean
    roleInTeam: string
    isLead: boolean
  }[]
  projects: { id: string; title: string; status: ProjectStatus; progressPercent: number }[]
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

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
  candidates: { id: string; name: string; rollNumber: string }[]
}) {
  const isAdmin = useIsAdmin()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    // :target highlights the card when opened via /teams#<id>.
    <Card id={team.id} className="scroll-mt-20 transition-shadow target:ring-2 target:ring-primary">
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>{team.name}</h2>
        </CardTitle>
        {team.description && <CardDescription>{team.description}</CardDescription>}
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" /> {plural(team.members.length, "member")}
          </span>
          <span className="flex items-center gap-1">
            <FolderKanban className="size-3.5" /> {plural(team.projects.length, "project")}
          </span>
        </div>
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

      <CardContent className="grid gap-4">
        <section className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Members</h3>
            {isAdmin &&
              (candidates.length > 0 ? (
                <TeamMemberDialog
                  teamId={team.id}
                  teamName={team.name}
                  candidates={candidates}
                  trigger={
                    <Button variant="outline" size="xs">
                      <UserPlus /> Add member
                    </Button>
                  }
                />
              ) : (
                <span className="text-muted-foreground text-xs">Every active member is on this team</span>
              ))}
          </div>
          {team.members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members yet.</p>
          ) : (
            <ul className="grid gap-1">
              {team.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-md py-1">
                  <Avatar className={cn(!m.isActive && "opacity-50")}>
                    <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Link
                        href={`/members/${m.id}`}
                        className={cn("truncate font-medium hover:underline", !m.isActive && "text-muted-foreground")}
                      >
                        {m.name}
                      </Link>
                      {m.isLead ? (
                        <Badge className="max-w-full" title={m.roleInTeam}>
                          <Crown data-icon="inline-start" />
                          <span className="truncate">{m.roleInTeam}</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="max-w-full" title={m.roleInTeam}>
                          <span className="truncate">{m.roleInTeam}</span>
                        </Badge>
                      )}
                      {!m.isActive && <ToneBadge tone="gray">Inactive</ToneBadge>}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{DESIGNATION_LABELS[m.designation]}</p>
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
          )}
        </section>

        <Separator />

        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Projects</h3>
          {team.projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">No projects yet.</p>
          ) : (
            <ul className="grid gap-2">
              {team.projects.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Link href={`/projects/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {p.title}
                  </Link>
                  <ProjectStatusBadge status={p.status} />
                  <div className="flex w-24 shrink-0 items-center gap-2">
                    <Progress value={p.progressPercent} aria-label={`${p.title} progress`} />
                    <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">
                      {p.progressPercent}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
