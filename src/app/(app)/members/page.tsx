import type { Metadata } from "next"
import { Download, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminOnly } from "@/components/admin-context"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { MemberFormDialog } from "@/components/members/member-form-dialog"
import { MembersTable, type MemberRow } from "@/components/members/members-table"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/auth"

export const metadata: Metadata = { title: "Members" }

export default async function MembersPage() {
  const members = await db.member.findMany({
    include: {
      _count: { select: { teams: true, projects: true, issuances: { where: { returnedDate: null } } } },
    },
  })

  // Contact details never leave the server for visitors; hiding them in the UI alone isn't enough.
  const admin = await isAdmin()
  const rows: MemberRow[] = members.map(({ _count, ...m }) => ({
    ...m,
    email: admin ? m.email : null,
    phone: admin ? m.phone : null,
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
          <Button variant="brand">
            <Plus /> Add member
          </Button>
        }
      />
    </AdminOnly>
  )
  const holding = rows.filter((m) => m.openIssuances > 0).length

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow="People · Roster"
        title="Members"
        description={
          <span className="font-mono text-xs tabular-nums">
            {members.length} members · {active} active · {holding} holding parts
          </span>
        }
      >
        <AdminOnly>
          <Button variant="outline" asChild>
            <a href="/api/export/members" download>
              <Download /> Export CSV
            </a>
          </Button>
        </AdminOnly>
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
