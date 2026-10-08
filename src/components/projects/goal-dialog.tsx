"use client"

import { useState, useTransition } from "react"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { setClubGoal, setProjectGoal } from "@/app/actions/projects"
import { formValues, runAction } from "@/lib/client"

/** Admin: set the club-wide goal (no projectId) or one project's own goal. */
export function GoalDialog({
  projectId,
  current,
  label = "Set goal",
}: {
  projectId?: string
  current: { percent: number | null; date: string | null }
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const save = (values: Record<string, string>) =>
    start(async () => {
      const res = await runAction(
        projectId ? setProjectGoal({ ...values, id: projectId }) : setClubGoal(values),
        values.goalPercent ? "Goal saved" : "Goal cleared"
      )
      if (res.ok) setOpen(false)
      else setErrors(res.fieldErrors ?? {})
    })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Target /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{projectId ? "Project goal" : "Club-wide goal"}</DialogTitle>
          <DialogDescription>
            {projectId
              ? "Overrides the club-wide goal for this project. Leave both blank to use the club goal."
              : "Every project without its own goal is measured against this."}{" "}
            Projects more than 10 points behind a steady pace towards it are flagged.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save(formValues(e.currentTarget))
          }}
        >
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <FormField label="Reach (%)" htmlFor="goalPercent" error={errors.goalPercent}>
              <Input id="goalPercent" name="goalPercent" type="number" min={1} max={100} defaultValue={current.percent ?? ""} placeholder="e.g. 50" />
            </FormField>
            <FormField label="By" htmlFor="goalDate" error={errors.goalDate}>
              <Input id="goalDate" name="goalDate" type="date" defaultValue={current.date ?? ""} />
            </FormField>
          </div>
          <DialogFooter>
            {(current.percent != null || current.date) && (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => save({ goalPercent: "", goalDate: "" })}>
                Clear goal
              </Button>
            )}
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Saving…" : "Save goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
