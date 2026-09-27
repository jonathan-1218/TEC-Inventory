"use client"

import { useState, useTransition } from "react"
import type { Member } from "@prisma/client"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { FormField } from "@/components/form-field"
import { createMember, updateMember } from "@/app/actions/members"
import { formValues, runAction } from "@/lib/client"
import { DESIGNATIONS, DESIGNATION_LABELS } from "@/lib/labels"

export type MemberFormValues = Pick<
  Member,
  "id" | "name" | "rollNumber" | "department" | "yearOfStudy" | "designation" | "email" | "phone" | "isActive"
>

const YEARS = ["1", "2", "3", "4", "5", "6"]

/**
 * Add a member, or edit one when `member` is given.
 * Uncontrolled with `trigger`, or controlled with `open`/`onOpenChange` (e.g. from a dropdown menu).
 */
export function MemberFormDialog({
  member,
  departments,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  member?: MemberFormValues
  /** Existing departments, offered as suggestions. */
  departments: string[]
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member ? `Edit ${member.name}` : "Add member"}</DialogTitle>
          <DialogDescription>
            {member ? "Update this member's details." : "Add a new club member."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <MemberForm member={member} departments={departments} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({
  member,
  departments,
  onDone,
}: {
  member?: MemberFormValues
  departments: string[]
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = member
        ? await runAction(updateMember({ ...values, id: member.id }), "Member updated")
        : await runAction(createMember(values), "Member added")
      // Unique email/roll number clashes come back as a toast with no field errors; keep the dialog open.
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id="member-form" onSubmit={onSubmit} className="grid gap-4">
        <FormField label="Name" htmlFor="member-name" error={errors.name}>
          <Input id="member-name" name="name" defaultValue={member?.name} required autoComplete="off" />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Roll number" htmlFor="member-roll" error={errors.rollNumber}>
            <Input
              id="member-roll"
              name="rollNumber"
              defaultValue={member?.rollNumber}
              placeholder="e.g. 24CS032"
              className="font-mono uppercase"
              required
              autoComplete="off"
            />
          </FormField>
          <FormField label="Department" htmlFor="member-dept" error={errors.department}>
            <Input
              id="member-dept"
              name="department"
              list="member-departments"
              defaultValue={member?.department}
              required
              autoComplete="off"
            />
            <datalist id="member-departments">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Year of study" error={errors.yearOfStudy}>
            <Select name="yearOfStudy" defaultValue={member ? String(member.yearOfStudy) : undefined} required>
              <SelectTrigger className="w-full" aria-label="Year of study">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    Year {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Designation" error={errors.designation}>
            <Select name="designation" defaultValue={member?.designation ?? "MEMBER"} required>
              <SelectTrigger className="w-full" aria-label="Designation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESIGNATIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DESIGNATION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="member-email" error={errors.email}>
            <Input
              id="member-email"
              name="email"
              type="email"
              defaultValue={member?.email}
              required
              autoComplete="off"
            />
          </FormField>
          <FormField label="Phone (optional)" htmlFor="member-phone" error={errors.phone}>
            <Input
              id="member-phone"
              name="phone"
              type="tel"
              defaultValue={member?.phone ?? ""}
              placeholder="+91 98765 43210"
              autoComplete="off"
            />
          </FormField>
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <Switch id="member-active" name="isActive" defaultChecked={member?.isActive ?? true} />
            <Label htmlFor="member-active">Active member</Label>
          </div>
          <p className={errors.isActive ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
            {errors.isActive?.[0] ?? "Inactive members keep their history but can't be issued components."}
          </p>
        </div>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form="member-form" disabled={pending}>
          {pending ? "Saving…" : member ? "Save changes" : "Add member"}
        </Button>
      </DialogFooter>
    </>
  )
}
