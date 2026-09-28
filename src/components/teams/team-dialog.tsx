"use client"

import { Children, useId, useState, useTransition } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { createTeam, updateTeam } from "@/app/actions/teams"
import { formValues, runAction } from "@/lib/client"

type TeamValues = { id: string; name: string; description: string | null }

/**
 * Create a team, or edit one when `team` is given.
 * Uncontrolled with `trigger`, or controlled with `open`/`onOpenChange` (e.g. from a dropdown menu).
 */
export function TeamDialog({
  team,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  team?: TeamValues
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="eyebrow">Team</p>
          <DialogTitle>{team ? "Edit team" : "New team"}</DialogTitle>
          <DialogDescription>
            {team ? `Update ${team.name}.` : "Group members who work together on projects."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <TeamForm team={team} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function TeamForm({ team, onDone }: { team?: TeamValues; onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const id = useId()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = team
        ? await runAction(updateTeam({ id: team.id, ...values }), "Team updated")
        : await runAction(createTeam(values), "Team created")
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id={`${id}-form`} onSubmit={onSubmit} className="grid gap-4">
        <FormField label="Name" htmlFor={`${id}-name`} error={errors.name}>
          <Input
            id={`${id}-name`}
            name="name"
            defaultValue={team?.name}
            placeholder="e.g. Robotics"
            maxLength={80}
            required
            autoFocus
          />
        </FormField>
        <FormField label="Description" htmlFor={`${id}-description`} error={errors.description}>
          <Textarea
            id={`${id}-description`}
            name="description"
            defaultValue={team?.description ?? ""}
            rows={3}
            maxLength={1000}
            placeholder="What does this team build?"
          />
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form={`${id}-form`} variant="brand" disabled={pending}>
          {pending ? "Saving…" : team ? "Save changes" : "Create team"}
        </Button>
      </DialogFooter>
    </>
  )
}
