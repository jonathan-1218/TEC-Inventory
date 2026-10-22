"use client"

import { useState, useTransition } from "react"
import { Check, KeyRound, Pencil, Plus, Trash2, Wand2, X } from "lucide-react"
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
import { ConfirmDelete } from "@/components/confirm-delete"
import { FormField } from "@/components/form-field"
import { createDesignation, deleteDesignation, updateDesignation } from "@/app/actions/designations"
import { approveAccount, createMentor, deleteAccount, deleteMentor, resetTeamPassword, updateMentor } from "@/app/actions/accounts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TIER_LABELS, type DesignationOpt, type DesignationTier } from "@/lib/designations"
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

/** Random 16-letter password in four groups (no look-alike characters), e.g. "k7m2-x9qd-p4wn-t8rc". */
function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const raw = Array.from(bytes, (b) => chars[b % chars.length]).join("")
  return raw.match(/.{4}/g)!.join("-")
}

export function ResetPassword({ id, email }: { id: string; email: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        setPassword("")
        setError(undefined)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Reset password for ${email}`}>
          <KeyRound />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            New password for <span className="font-mono">{email}</span>. The old one and any open sessions stop working. Tell the
            team the new password in person.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const res = await runAction(resetTeamPassword({ id, password }), "Password changed")
              if (res.ok) setOpen(false)
              else setError(res.error)
            })
          }}
        >
          <FormField label="New password" htmlFor={`reset-${id}`} error={error} hint="10+ characters; a long generated one is best.">
            <div className="flex gap-2">
              <Input
                id={`reset-${id}`}
                value={password}
                autoComplete="off"
                required
                maxLength={200}
                className="font-mono"
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                <Wand2 /> Generate
              </Button>
            </div>
          </FormField>
          <DialogFooter>
            <Button type="submit" variant="brand" disabled={pending || !password}>
              {pending ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveDesignation({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmDelete
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`}>
          <Trash2 />
        </Button>
      }
      title={`Remove the designation “${label}”?`}
      description="This only works when no member has it. Change those members first."
      confirmLabel="Remove"
      successMessage="Designation removed"
      onConfirm={() => deleteDesignation({ id })}
    />
  )
}

/** Add a designation, or edit one: its name, which group it belongs to, and where it sorts. */
export function DesignationDialog({ designation, nextRank }: { designation?: DesignationOpt; nextRank: number }) {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<DesignationTier>(designation?.tier ?? "OFFICE")
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{designation ? `Edit ${designation.label}` : "Add designation"}</DialogTitle>
          <DialogDescription>Designations are the roles you can give a member, like President or Core Member.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const values = { ...formValues(e.currentTarget), tier }
            start(async () => {
              const res = await runAction(
                designation ? updateDesignation({ ...values, id: designation.id }) : createDesignation(values),
                designation ? "Designation updated" : "Designation added"
              )
              if (res.ok) setOpen(false)
              else setErrors(res.fieldErrors ?? {})
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
