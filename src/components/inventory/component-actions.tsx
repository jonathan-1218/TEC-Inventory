"use client"

import { PackageMinus, Pencil, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminOnly } from "@/components/admin-context"
import { ConfirmDelete } from "@/components/confirm-delete"
import { IssueDialog } from "@/components/issue-dialog"
import { ReturnDialog } from "@/components/return-dialog"
import { ComponentFormDialog } from "@/components/inventory/component-form-dialog"
import { OpenIssuancesDialog, type OpenIssuance } from "@/components/inventory/open-issuances-dialog"
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
  openIssuances: OpenIssuance[]
}) {
  return (
    <AdminOnly>
      <ConfirmDelete
        trigger={
          <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} className="hover:text-danger">
            <Trash2 />
          </Button>
        }
        title={`Delete ${c.name}?`}
        description={
          c.quantityIssued > 0
            ? `${c.quantityIssued} unit(s) are still issued on ${openIssuances.length} open issuance(s). Return them first — deleting will be refused until then.`
            : "This permanently removes the component, its issuance history and project requirements."
        }
        successMessage="Component deleted"
        onConfirm={() => deleteComponent({ id: c.id, redirectTo: "/inventory" })}
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
      {openIssuances.length === 1 ? (
        // One checkout out: go straight to its return form.
        <ReturnDialog
          issuance={{
            id: openIssuances[0].id,
            quantity: openIssuances[0].quantity,
            componentName: c.name,
            memberName: openIssuances[0].member.name,
          }}
          trigger={
            <Button variant="outline">
              <Undo2 /> Return
            </Button>
          }
        />
      ) : openIssuances.length > 1 && (
        <OpenIssuancesDialog
          componentName={c.name}
          issuances={openIssuances}
          trigger={
            <Button variant="outline">
              <Undo2 /> Return…
            </Button>
          }
        />
      )}
      <IssueDialog
        options={options}
        componentId={c.id}
        trigger={
          <Button variant="brand" disabled={c.quantityAvailable <= 0}>
            <PackageMinus /> Issue
          </Button>
        }
      />
    </AdminOnly>
  )
}
