"use client"

import { Children, useState, useTransition } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { createMember, updateMember } from "@/app/actions/members"
import { formValues, runAction } from "@/lib/client"
import { useDesignations } from "@/components/designations-context"

export type MemberFormValues = Pick<
  Member,
  "id" | "name" | "rollNumber" | "department" | "yearOfStudy" | "designation" | "email" | "phone" | "photo" | "bio" | "isActive"
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
  defaultDesignation,
}: {
  member?: MemberFormValues
  /** Pre-selected designation when adding (e.g. an office bearer from the cards view). */
  defaultDesignation?: string
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
      {trigger && <DialogTrigger asChild>{Children.toArray(trigger)[0]}</DialogTrigger>}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Member</p>
          <DialogTitle>{member ? `Edit ${member.name}` : "Add member"}</DialogTitle>
          <DialogDescription>
            {member ? "Update this member's details." : "Add a new club member."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <MemberForm member={member} departments={departments} defaultDesignation={defaultDesignation} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({
  member,
  departments,
  defaultDesignation,
  onDone,
}: {
  member?: MemberFormValues
  departments: string[]
  defaultDesignation?: string
  onDone: () => void
}) {
  const roles = useDesignations()
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
            <Select name="designation" defaultValue={member?.designation ?? defaultDesignation ?? "MEMBER"} required>
              <SelectTrigger className="w-full" aria-label="Designation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.list.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email (optional)" htmlFor="member-email" error={errors.email}>
            <Input
              id="member-email"
              name="email"
              type="email"
              defaultValue={member?.email ?? ""}
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
        <PhotoField initial={member?.photo ?? ""} error={errors.photo?.[0]} />
        <FormField label="About (optional)" htmlFor="member-bio" error={errors.bio} hint="Shown on the member's card. A sentence or two.">
          <Textarea id="member-bio" name="bio" rows={3} maxLength={1000} defaultValue={member?.bio ?? ""} />
        </FormField>
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
        <Button type="submit" form="member-form" variant="brand" disabled={pending}>
          {pending ? "Saving…" : member ? "Save changes" : "Add member"}
        </Button>
      </DialogFooter>
    </>
  )
}

const PHOTO_W = 360
const PHOTO_H = 480

/** Reads an image file, crops it to 3:4 and re-encodes a small JPEG, so the stored photo stays ~40 KB. */
async function resizeToJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  canvas.width = PHOTO_W
  canvas.height = PHOTO_H
  const scale = Math.max(PHOTO_W / bitmap.width, PHOTO_H / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  canvas.getContext("2d")!.drawImage(bitmap, (PHOTO_W - w) / 2, (PHOTO_H - h) / 2, w, h)
  return canvas.toDataURL("image/jpeg", 0.82)
}

function PhotoField({ initial, error }: { initial: string; error?: string }) {
  const [photo, setPhoto] = useState(initial)
  const [problem, setProblem] = useState<string>()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="member-photo">Photo (optional)</Label>
      {/* The resized image travels with the form in this hidden field. */}
      <input type="hidden" name="photo" value={photo} />
      <div className="flex items-center gap-3">
        <span className="bg-muted ring-border grid h-20 w-[3.75rem] shrink-0 place-items-center overflow-hidden rounded-lg ring-1">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-muted-foreground text-xs">No photo</span>
          )}
        </span>
        <div className="grid gap-1.5">
          <input
            id="member-photo"
            type="file"
            accept="image/*"
            className="text-muted-foreground file:bg-secondary file:text-secondary-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                setProblem(undefined)
                setPhoto(await resizeToJpeg(file))
              } catch {
                setProblem("Couldn't read that image. Try a JPG or PNG.")
              }
            }}
          />
          {photo && (
            <Button type="button" variant="ghost" size="xs" className="w-fit" onClick={() => setPhoto("")}>
              Remove photo
            </Button>
          )}
        </div>
      </div>
      {(problem || error) && <p className="text-danger text-xs font-medium">{problem ?? error}</p>}
    </div>
  )
}
