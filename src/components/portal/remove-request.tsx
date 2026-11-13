"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDelete } from "@/components/confirm-delete"
import { removeOwnRequest } from "@/app/actions/portal"

/** Cancel a waiting part request, or clear a declined one from the list. */
export function RemoveRequestButton({ id, declined }: { id: string; declined: boolean }) {
  const verb = declined ? "Dismiss" : "Cancel"
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label={`${verb} request`}>
          <X />
        </Button>
      }
      title={`${verb} this request?`}
      description={declined ? "It will be removed from your list." : "The club admins will no longer see it."}
      confirmLabel={declined ? "Dismiss" : "Cancel request"}
      successMessage={declined ? "Request dismissed" : "Request cancelled"}
      onConfirm={() => removeOwnRequest({ id })}
    />
  )
}
