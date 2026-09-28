"use client"

import { useId, useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { PRIORITY_LABELS, PriorityBars, TASK_STATUS_LABELS, TaskStatusIcon, type TaskStatus } from "@/components/badges"
import { ConfirmDelete } from "@/components/confirm-delete"
import { FormField } from "@/components/form-field"
import type { MemberOption, TaskItem } from "@/components/tasks/task-parts"
import { createTask, deleteTask, updateTask } from "@/app/actions/tasks"
import { formValues, runAction } from "@/lib/client"
import { toDateInput } from "@/lib/dates"

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const

/** What the dialog is doing: editing a task, or adding one (optionally straight into a column). */
export type TaskEditing = { task: TaskItem } | { status: TaskStatus } | null

/**
 * Create / edit / delete a task. Controlled: open while `editing` is set.
 * Assignee list: the project's members first, then everyone else.
 */
export function TaskDialog({
  projectId,
  editing,
  onClose,
  projectMembers,
  otherMembers,
}: {
  projectId: string
  editing: TaskEditing
  onClose: () => void
  projectMembers: MemberOption[]
  otherMembers: MemberOption[]
}) {
  const task = editing && "task" in editing ? editing.task : undefined
  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Task</p>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {task ? "Change the details, move it along, or delete it." : "Break the project into something one person can finish."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form resets each time. */}
        {editing && (
          <TaskForm
            projectId={projectId}
            task={task}
            status={task?.status ?? ("status" in editing ? editing.status : "TODO")}
            projectMembers={projectMembers}
            otherMembers={otherMembers}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TaskForm({
  projectId,
  task,
  status,
  projectMembers,
  otherMembers,
  onDone,
}: {
  projectId: string
  task?: TaskItem
  status: TaskStatus
  projectMembers: MemberOption[]
  otherMembers: MemberOption[]
  onDone: () => void
}) {
  const id = useId()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  // Keep a current assignee selectable even if they left the project / club.
  const known = new Set([...projectMembers, ...otherMembers].map((m) => m.id))
  const others = task?.assignee && !known.has(task.assignee.id) ? [...otherMembers, task.assignee] : otherMembers

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const values = formValues(e.currentTarget)
    startTransition(async () => {
      const res = task
        ? await runAction(updateTask({ ...values, id: task.id }), "Task saved")
        : await runAction(createTask({ ...values, projectId }), "Task added")
      if (res.ok) onDone()
      else setErrors(res.fieldErrors ?? {})
    })
  }

  return (
    <>
      <form id={`${id}-form`} onSubmit={onSubmit} className="grid gap-4">
        <FormField label="Title" htmlFor={`${id}-title`} error={errors.title}>
          <Input
            id={`${id}-title`}
            name="title"
            defaultValue={task?.title}
            required
            maxLength={160}
            autoFocus
            placeholder="e.g. Solder the sensor header"
          />
        </FormField>
        <FormField label="Details" htmlFor={`${id}-description`} error={errors.description}>
          <Textarea
            id={`${id}-description`}
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={task?.description ?? ""}
            placeholder="Optional: what done looks like, links, parts needed"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Status" error={errors.status}>
            <Select name="status" defaultValue={status}>
              <SelectTrigger className="w-full" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <TaskStatusIcon status={s} /> {TASK_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Priority" error={errors.priority}>
            <Select name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
              <SelectTrigger className="w-full" aria-label="Priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <PriorityBars priority={p} /> {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Assignee" error={errors.assigneeId}>
            <Select name="assigneeId" defaultValue={task?.assignee?.id ?? "none"}>
              <SelectTrigger className="w-full" aria-label="Assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {projectMembers.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>On this project</SelectLabel>
                    {projectMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {others.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Other members</SelectLabel>
                    {others.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Due date" htmlFor={`${id}-due`} error={errors.dueDate}>
            <Input id={`${id}-due`} name="dueDate" type="date" defaultValue={toDateInput(task?.dueDate)} />
          </FormField>
        </div>
      </form>
      <DialogFooter className="sm:justify-between">
        {task ? (
          <ConfirmDelete
            trigger={
              <Button type="button" variant="destructive" disabled={pending}>
                <Trash2 /> Delete task
              </Button>
            }
            title={`Delete “${task.title}”?`}
            description="The task is removed from the project. This can't be undone."
            successMessage="Task deleted"
            onConfirm={() => deleteTask({ id: task.id })}
            onDone={onDone}
          />
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" form={`${id}-form`} disabled={pending}>
            {pending ? "Saving…" : task ? "Save task" : "Add task"}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
