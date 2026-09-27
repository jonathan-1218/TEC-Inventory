"use client"

import { useId, useState, useTransition } from "react"
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
import { upsertTeamMember } from "@/app/actions/teams"
import { formValues, runAction } from "@/lib/client"

const ROLE_SUGGESTIONS = ["Team Lead", "Hardware", "Software", "Design", "Mentor", "Cloud", "Documentation"]

type Candidate = { id: string; name: string; rollNumber: string }
type Existing = { id: string; name: string; roleInTeam: string }

type Props = {
  teamId: string
  teamName: string
  trigger: React.ReactNode
} & (
  /** Add: pick from these active members. */
  | { candidates: Candidate[]; member?: never }
  /** Change role of someone already on the team. */
  | { member: Existing; candidates?: never }
)

/** Add a member to a team, or change an existing member's role (both via upsertTeamMember). */
export function TeamMemberDialog({ teamId, teamName, trigger, candidates, member }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{member ? `Change ${member.name}'s role` : "Add member"}</DialogTitle>
          <DialogDescription>
            {member ? `Their role on ${teamName}.` : `Add an active club member to ${teamName}.`}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so form state resets each time. */}
        <MemberForm teamId={teamId} candidates={candidates} member={member} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({
  teamId,
  candidates,
  member,
  onDone,
}: {
  teamId: string
  candidates?: Candidate[]
  member?: Existing
  onDone: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const id = useId()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = await runAction(upsertTeamMember(values), member ? "Role updated" : "Member added")
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id={`${id}-form`} onSubmit={onSubmit} className="grid gap-4">
        <input type="hidden" name="teamId" value={teamId} />
        {member ? (
          <input type="hidden" name="memberId" value={member.id} />
        ) : (
          <FormField label="Member" error={errors.memberId ?? errors.teamId}>
            <Select name="memberId" required>
              <SelectTrigger className="w-full" aria-label="Member">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {candidates?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.rollNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField
          label="Role in team"
          htmlFor={`${id}-role`}
          error={errors.roleInTeam}
          hint="Pick a suggestion or type your own."
        >
          <Input
            id={`${id}-role`}
            name="roleInTeam"
            list={`${id}-roles`}
            defaultValue={member?.roleInTeam}
            placeholder="e.g. Hardware"
            maxLength={60}
            autoComplete="off"
            required
            autoFocus={!!member}
          />
          <datalist id={`${id}-roles`}>
            {ROLE_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" form={`${id}-form`} disabled={pending}>
          {pending ? "Saving…" : member ? "Save role" : "Add to team"}
        </Button>
      </DialogFooter>
    </>
  )
}
