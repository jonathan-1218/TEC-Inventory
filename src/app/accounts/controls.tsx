"use client"

import { useState, useTransition } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ConfirmDelete } from "@/components/confirm-delete"
import { FormField } from "@/components/form-field"
import { approveAccount, createMentor, deleteAccount, deleteMentor, updateMentor } from "@/app/actions/accounts"
import { formValues, runAction } from "@/lib/client"

export function ApproveButtons({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition()
  return (
    <div className="flex shrink-0 gap-2">
      <ConfirmDelete
        trigger={
          <Button variant="outline" size="sm">
            <X /> Reject
          </Button>
        }
        title={`Reject “${title}”?`}
        description="The sign-up is deleted. The team can register again."
        confirmLabel="Reject"
        successMessage="Sign-up rejected"
        onConfirm={() => deleteAccount({ id })}
      />
      <Button
        variant="brand"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => void (await runAction(approveAccount({ id }), "Approved — project created")))}
      >
        <Check /> {pending ? "Approving…" : "Approve"}
      </Button>
    </div>
  )
}

export function RemoveLogin({ id, email }: { id: string; email: string }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove login ${email}`}>
          <Trash2 />
        </Button>
      }
      title={`Remove the login ${email}?`}
      description="The project and everything in it stay. The team can no longer log in."
      confirmLabel="Remove"
      successMessage="Login removed"
      onConfirm={() => deleteAccount({ id })}
    />
  )
}

export function RemoveMentor({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`}>
          <Trash2 />
        </Button>
      }
      title={`Remove ${name} from the mentor list?`}
      description="Their projects keep going without a mentor listed."
      confirmLabel="Remove"
      successMessage="Mentor removed"
      onConfirm={() => deleteMentor({ id })}
    />
  )
}

type MentorValues = { id: string; name: string; designation: string; department: string | null }

export function MentorDialog({ mentor }: { mentor?: MentorValues }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mentor ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${mentor.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus /> Add mentor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mentor ? `Edit ${mentor.name}` : "Add mentor"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const values = formValues(e.currentTarget)
            start(async () => {
              const res = await runAction(
                mentor ? updateMentor({ ...values, id: mentor.id }) : createMentor(values),
                mentor ? "Mentor updated" : "Mentor added"
              )
              if (res.ok) setOpen(false)
              else setErrors(res.fieldErrors ?? {})
            })
          }}
        >
          <FormField label="Name" htmlFor="mentor-name" error={errors.name}>
            <Input id="mentor-name" name="name" required maxLength={100} defaultValue={mentor?.name} placeholder="Dr. A. Kumar" />
          </FormField>
          <FormField label="Designation" htmlFor="mentor-designation" error={errors.designation}>
            <Input
              id="mentor-designation"
              name="designation"
              required
              maxLength={80}
              defaultValue={mentor?.designation}
              placeholder="Assistant Professor"
            />
          </FormField>
          <FormField label="Department" htmlFor="mentor-department" error={errors.department} hint="Optional">
            <Input id="mentor-department" name="department" maxLength={80} defaultValue={mentor?.department ?? ""} />
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
