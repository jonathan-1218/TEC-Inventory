"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/form-field"
import { addProgressUpdate } from "@/app/actions/projects"
import { formValues, runAction } from "@/lib/client"

type MemberOption = { id: string; name: string }

type Props = {
  projectId: string
  /** "YYYY-MM-DD", computed on the server so SSR and hydration agree. */
  today: string
  currentPercent: number
  /** Share of tasks done (null without tasks): pre-fills the % and shows as "Tasks say N%". */
  suggestedPercent?: number | null
  projectMembers: MemberOption[]
  otherMembers: MemberOption[]
}

/** Inline "add update" form; remounts (resets) after each successful save. */
export function ProgressUpdateForm(props: Props) {
  const [key, setKey] = useState(0)
  // Also remount when ticking tasks changes the suggestion, so the pre-filled % follows "Tasks say N%".
  return <UpdateForm key={`${key}-${props.suggestedPercent}`} {...props} onSaved={() => setKey((k) => k + 1)} />
}

function UpdateForm({
  projectId,
  today,
  currentPercent,
  suggestedPercent = null,
  projectMembers,
  otherMembers,
  onSaved,
}: Props & { onSaved: () => void }) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = await runAction(addProgressUpdate({ ...values, projectId }), "Progress update added")
      if (res.ok) onSaved()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <form onSubmit={onSubmit} aria-label="Add progress update" className="bg-muted/40 grid gap-3 rounded-lg border p-3">
      <p className="eyebrow">New update</p>
      <div className="grid items-start gap-3 sm:grid-cols-3">
        <FormField label="Date" htmlFor="pu-date" error={errors.date}>
          <Input id="pu-date" name="date" type="date" defaultValue={today} required />
        </FormField>
        <FormField
          label="Progress %"
          htmlFor="pu-percent"
          error={errors.percentAtUpdate}
          hint={
            suggestedPercent !== null ? (
              <>
                Tasks say <span className="text-foreground font-mono">{suggestedPercent}%</span> · now{" "}
                <span className="font-mono">{currentPercent}%</span>
              </>
            ) : undefined
          }
        >
          <Input
            id="pu-percent"
            name="percentAtUpdate"
            type="number"
            min={0}
            max={100}
            defaultValue={suggestedPercent ?? currentPercent}
            required
          />
        </FormField>
        <FormField label="Updated by" error={errors.updatedByMemberId}>
          <Select name="updatedByMemberId" defaultValue="none">
            <SelectTrigger className="w-full" aria-label="Updated by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {projectMembers.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Project members</SelectLabel>
                  {projectMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {otherMembers.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Other members</SelectLabel>
                  {otherMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      <FormField label="Note" htmlFor="pu-note" error={errors.note}>
        <Textarea
          id="pu-note"
          name="note"
          rows={2}
          required
          maxLength={2000}
          placeholder="What changed since the last update?"
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Add update"}
        </Button>
      </div>
    </form>
  )
}
