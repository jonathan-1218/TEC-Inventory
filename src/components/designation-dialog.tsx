"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/form-field"
import { createDesignation, updateDesignation } from "@/app/actions/designations"
import { TIER_LABELS, type DesignationOpt, type DesignationTier } from "@/lib/designations"
import { formValues, runAction } from "@/lib/client"

/**
 * Add a designation, or edit one: its name, which group it belongs to, and where it sorts.
 * Uncontrolled (renders its own button), or controlled with `open` / `onOpenChange` and no button,
 * e.g. opened from the member form's "Add new designation" option; `onSaved` receives the saved designation.
 */
export function DesignationDialog({
  designation,
  nextRank,
  defaultTier = "OFFICE",
  open: openProp,
  onOpenChange,
  onSaved,
}: {
  designation?: DesignationOpt
  nextRank: number
  defaultTier?: DesignationTier
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved?: (saved: DesignationOpt) => void
}) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = openProp ?? internalOpen
  const setOpen = (o: boolean) => {
    if (!controlled) setInternalOpen(o)
    onOpenChange?.(o)
  }
  const [tier, setTier] = useState<DesignationTier>(designation?.tier ?? defaultTier)
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {designation ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${designation.label}`}>
              <Pencil />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Plus /> Add designation
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{designation ? `Edit ${designation.label}` : "Add designation"}</DialogTitle>
          <DialogDescription>Designations are the roles you can give a member, like President or Core Member.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation() // this dialog can sit inside another form (React bubbles events through portals)
            const form = formValues(e.currentTarget)
            const values = { ...form, tier }
            start(async () => {
              const res = await runAction(
                designation ? updateDesignation({ ...values, id: designation.id }) : createDesignation(values),
                designation ? "Designation updated" : "Designation added"
              )
              if (res.ok) {
                onSaved?.({ id: res.data.id, label: form.label.trim(), tier, rank: Number(form.rank) })
                setOpen(false)
                router.refresh() // the layout holds the shared list of designations
              } else setErrors(res.fieldErrors ?? {})
            })
          }}
        >
          <FormField label="Name" htmlFor="designation-label" error={errors.label}>
            <Input id="designation-label" name="label" required maxLength={60} defaultValue={designation?.label} placeholder="e.g. Technical Lead" />
          </FormField>
          <FormField label="Group" error={errors.tier} hint="Office bearers are shown as cards on the Members page.">
            <Select value={tier} onValueChange={(v) => setTier(v as DesignationTier)}>
              <SelectTrigger className="w-full" aria-label="Group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIER_LABELS) as DesignationTier[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Order" htmlFor="designation-rank" error={errors.rank} hint="Lower numbers come first (President is 10, Vice President 20…).">
            <Input id="designation-rank" name="rank" type="number" min={0} max={10000} required defaultValue={designation?.rank ?? nextRank} />
          </FormField>
          <DialogFooter>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
