"use client"

import { useState, useTransition } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { ActionResult } from "@/lib/action"
import { runAction } from "@/lib/client"

/**
 * Confirmation dialog for destructive actions. Stays open and toasts the error if the
 * action fails (e.g. "component has open issuances"); closes and toasts on success.
 * Uncontrolled with `trigger`, or controlled with `open`/`onOpenChange` (e.g. from a dropdown menu).
 */
export function ConfirmDelete({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  successMessage = "Deleted",
  onConfirm,
  onDone,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode
  title: string
  description: React.ReactNode
  confirmLabel?: string
  successMessage?: string
  onConfirm: () => Promise<ActionResult<unknown>>
  onDone?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setInternalOpen(o)
    onOpenChange?.(o)
  }
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault()
              startTransition(async () => {
                const res = await runAction(onConfirm(), successMessage)
                if (res.ok) {
                  setOpen(false)
                  onDone?.()
                }
              })
            }}
          >
            {pending ? `${confirmLabel.replace(/e$/, "")}ing…` : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
