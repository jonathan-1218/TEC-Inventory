"use client"

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDelete } from "@/components/confirm-delete"
import { AddTeamMember } from "@/components/teams/team-card"
import { TeamDialog } from "@/components/teams/team-dialog"
import { deleteTeam } from "@/app/actions/teams"

/** Team detail header: add member (primary), edit, delete (back to /teams). */
export function TeamHeaderActions({
  team,
  candidates,
}: {
  team: { id: string; name: string; description: string | null }
  candidates: { id: string; name: string; rollNumber: string }[]
}) {
  return (
    <>
      <AddTeamMember teamId={team.id} teamName={team.name} candidates={candidates} variant="brand" />
      <TeamDialog
        team={team}
        trigger={
          <Button variant="outline">
            <Pencil /> Edit
          </Button>
        }
      />
      <ConfirmDelete
        trigger={
          <Button variant="destructive">
            <Trash2 /> Delete
          </Button>
        }
        title={`Delete ${team.name}?`}
        description="Projects in this team will become team-less; members are not deleted."
        successMessage="Team deleted"
        onConfirm={() => deleteTeam({ id: team.id, redirectTo: "/teams" })}
      />
    </>
  )
}
