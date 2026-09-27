import type { Metadata } from "next"
import { Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminOnly } from "@/components/admin-context"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { MemberFormDialog } from "@/components/members/member-form-dialog"
import { MembersTable, type MemberRow } from "@/components/members/members-table"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Members" }

export default async function MembersPage() {
  const members = await db.member.findMany({
    include: {
      _count: { select: { teams: true, projects: true, issuances: { where: { returnedDate: null } } } },
    },
  })

  const rows: MemberRow[] = members.map(({ _count, ...m }) => ({
    ...m,
    teamCount: _count.teams,
    projectCount: _count.projects,
    openIssuances: _count.issuances,
  }))
  const departments = [...new Set(members.map((m) => m.department))].sort()
  const active = members.filter((m) => m.isActive).length

  const addButton = (
    <AdminOnly>
      <MemberFormDialog
        departments={departments}
        trigger={
          <Button>
            <Plus /> Add member
          </Button>
        }
      />
    </AdminOnly>
  )

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Members"
        description={`${active} active of ${members.length} club members, their roles and what they're holding.`}
      >
        {addButton}
      </PageHeader>
      {members.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" description="Add the club's members to start issuing components.">
          {addButton}
        </EmptyState>
      ) : (
        <MembersTable members={rows} departments={departments} />
      )}
    </div>
  )
}
