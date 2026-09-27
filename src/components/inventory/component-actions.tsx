"use client"

import { PackageMinus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminOnly } from "@/components/admin-context"
import { ConfirmDelete } from "@/components/confirm-delete"
import { IssueDialog } from "@/components/issue-dialog"
import { ComponentFormDialog } from "@/components/inventory/component-form-dialog"
import { deleteComponent } from "@/app/actions/components"
import type { ComponentWithStock, SelectOptions } from "@/lib/queries"

/** Admin actions in the component detail page header. */
export function ComponentActions({
  component: c,
  options,
  openIssuances,
}: {
  component: ComponentWithStock
  options: SelectOptions
  openIssuances: number
}) {

  return (
    <AdminOnly>
      <IssueDialog
        options={options}
        componentId={c.id}
        trigger={
          <Button disabled={c.quantityAvailable <= 0}>
            <PackageMinus /> Issue
          </Button>
        }
      />
      <ComponentFormDialog
        component={c}
        issued={c.quantityIssued}
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
        title={`Delete ${c.name}?`}
        description={
          c.quantityIssued > 0
            ? `${c.quantityIssued} unit(s) are still issued on ${openIssuances} open issuance(s). Return them first — deleting will be refused until then.`
            : "This permanently removes the component, its issuance history and project requirements."
        }
        successMessage="Component deleted"
        onConfirm={() => deleteComponent({ id: c.id, redirectTo: "/inventory" })}
      />
    </AdminOnly>
  )
}
