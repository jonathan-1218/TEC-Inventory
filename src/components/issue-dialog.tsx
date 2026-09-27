"use client"

import { useState, useTransition } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { issueComponent } from "@/app/actions/issuances"
import { formValues, runAction } from "@/lib/client"
import type { SelectOptions } from "@/lib/queries"

const today = () => new Date().toLocaleDateString("en-CA")

type IssueDefaults = { componentId?: string; projectId?: string; memberId?: string }

/**
 * Check out component units to a member (optionally for a project).
 * Uncontrolled with `trigger`, or controlled with `open`/`onOpenChange` (e.g. from a dropdown menu).
 */
export function IssueDialog({
  options,
  trigger,
  open: openProp,
  onOpenChange,
  ...defaults
}: IssueDefaults & {
  options: SelectOptions
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = (o: boolean) => {
    if (openProp === undefined) setInternalOpen(o)
    onOpenChange?.(o)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue component</DialogTitle>
          <DialogDescription>Check out working units to a member.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <IssueForm options={options} defaults={defaults} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function IssueForm({
  options,
  defaults,
  onDone,
}: {
  options: SelectOptions
  defaults: IssueDefaults
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [componentId, setComponentId] = useState(defaults.componentId ?? "")
  const selected = options.components.find((c) => c.id === componentId)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = await runAction(issueComponent(values), "Issued")
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id="issue-form" onSubmit={onSubmit} className="grid gap-4">
        <FormField label="Component" error={errors.componentId}>
          <Select name="componentId" value={componentId} onValueChange={setComponentId} required>
            <SelectTrigger className="w-full" aria-label="Component">
              <SelectValue placeholder="Select a component" />
            </SelectTrigger>
            <SelectContent>
              {options.components.map((c) => (
                <SelectItem key={c.id} value={c.id} disabled={c.quantityAvailable <= 0}>
                  {c.name}
                  {c.modelNumber ? ` (${c.modelNumber})` : ""} — {c.quantityAvailable} available
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Quantity"
            htmlFor="issue-qty"
            error={errors.quantity}
            hint={selected ? `${selected.quantityAvailable} available` : undefined}
          >
            <Input
              id="issue-qty"
              name="quantity"
              type="number"
              min={1}
              max={selected?.quantityAvailable || undefined}
              defaultValue={1}
              required
            />
          </FormField>
          <FormField label="Issued to" error={errors.issuedToMemberId}>
            <Select name="issuedToMemberId" defaultValue={defaults.memberId} required>
              <SelectTrigger className="w-full" aria-label="Issued to">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {options.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.rollNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="Project (optional)" error={errors.projectId}>
          <Select name="projectId" defaultValue={defaults.projectId ?? "none"}>
            <SelectTrigger className="w-full" aria-label="Project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {options.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Issued on" htmlFor="issue-date" error={errors.issuedDate}>
            <Input id="issue-date" name="issuedDate" type="date" defaultValue={today()} required />
          </FormField>
          <FormField label="Expected return" htmlFor="issue-return" error={errors.expectedReturnDate}>
            <Input id="issue-return" name="expectedReturnDate" type="date" />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="issue-notes" error={errors.notes}>
          <Textarea id="issue-notes" name="notes" rows={2} placeholder="Purpose, condition at checkout…" />
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="issue-form" disabled={pending}>
          {pending ? "Issuing…" : "Issue"}
        </Button>
      </DialogFooter>
    </>
  )
}
