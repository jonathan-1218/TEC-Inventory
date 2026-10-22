"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MemberFormDialog } from "@/components/members/member-form-dialog"
import { OfficerCard } from "@/components/members/officer-card"
import { useDesignations } from "@/components/designations-context"
import type { MemberRow } from "@/components/members/members-table"

/** Cards view: the club's office bearers only. The list view (toggle) shows every member. */
export function MembersCards({ members, departments, admin }: { members: MemberRow[]; departments: string[]; admin: boolean }) {
  const roles = useDesignations()
  const officers = members
    .filter((m) => roles.tier(m.designation) === "OFFICE")
    .sort((a, b) => roles.rank(a.designation) - roles.rank(b.designation) || a.name.localeCompare(b.name))
  const add = admin && (
    <MemberFormDialog
      departments={departments}
      defaultDesignation={roles.list.find((d) => d.tier === "OFFICE")?.id}
      trigger={
        <Button variant="outline" size="sm">
          <Plus /> Add office bearer
        </Button>
      }
    />
  )
  if (officers.length === 0) {
    return (
      <div className="bg-card grid justify-items-center gap-3 rounded-xl border py-16 text-center">
        <p className="text-muted-foreground max-w-md text-sm">
          No office bearers match these filters. Switch to the list view to see every member.
        </p>
        {add}
      </div>
    )
  }
  return (
    <section aria-label="Office bearers" className="grid gap-6">
      <div className="flex items-baseline gap-3 border-b pb-2">
        <h2 className="font-display text-lg font-extrabold tracking-tight">Office bearers</h2>
        <span className="text-muted-foreground font-mono text-sm tabular-nums">{officers.length}</span>
        <span className="text-muted-foreground ms-auto hidden text-sm sm:block">Select a card to read about them</span>
        {add && <span className="sm:ms-0">{add}</span>}
      </div>
      <ul className="grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {officers.map((m) => (
          <li key={m.id}>
            <OfficerCard m={m} departments={departments} admin={admin} />
          </li>
        ))}
      </ul>
    </section>
  )
}
