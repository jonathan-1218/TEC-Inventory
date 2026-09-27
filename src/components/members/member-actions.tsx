"use client"

import { PackagePlus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useIsAdmin } from "@/components/admin-context"
import { ConfirmDelete } from "@/components/confirm-delete"
import { IssueDialog } from "@/components/issue-dialog"
import { MemberFormDialog, type MemberFormValues } from "@/components/members/member-form-dialog"
import { deleteMember } from "@/app/actions/members"
import type { SelectOptions } from "@/lib/queries"

/** Admin-only header actions on the member detail page. */
export function MemberActions({
  member,
  departments,
  options,
  openIssuances,
}: {
  member: MemberFormValues
  departments: string[]
  /** Null when the member is inactive (they can't be issued anything). */
  options: SelectOptions | null
  openIssuances: number
}) {
  const admin = useIsAdmin()
  if (!admin) return null

  return (
    <>
      {options && (
        <IssueDialog
          options={options}
          memberId={member.id}
          trigger={
            <Button>
              <PackagePlus /> Issue to member
            </Button>
          }
        />
      )}
      <MemberFormDialog
        member={member}
        departments={departments}
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
        title={`Delete ${member.name}?`}
        description={
          openIssuances > 0
            ? `${member.name} still holds ${openIssuances} open issuance(s), so they can't be deleted. Record the returns first, or edit the member and mark them inactive instead.`
            : `This permanently removes ${member.name}, their team/project roles and issuance history. To keep their history, mark them inactive instead.`
        }
        successMessage="Member deleted"
        onConfirm={() => deleteMember({ id: member.id, redirectTo: "/members" })}
      />
    </>
  )
}
