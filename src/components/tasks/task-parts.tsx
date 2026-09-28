"use client"

import { useOptimistic, useTransition } from "react"
import Link from "next/link"
import { CalendarDays, TriangleAlert } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { PriorityBadge, TaskStatusBadge, TaskStatusIcon, type TaskPriority, type TaskStatus } from "@/components/badges"
import { setTaskDone } from "@/app/actions/tasks"
import { runAction } from "@/lib/client"
import { formatDate, parseDateInput, toDateInput } from "@/lib/dates"
import { cn } from "@/lib/utils"

/** A task as client components get it (plain, serialisable). */
export type TaskItem = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: Date | null
  assignee: { id: string; name: string } | null
  /** Only on the cross-project tasks page. */
  project?: { id: string; title: string }
}

export type MemberOption = { id: string; name: string }

const DAY = 86_400_000

/** Days from today ("YYYY-MM-DD") to the due date: 0 today, negative = overdue. */
export function daysLeft(due: Date, today: string): number {
  return Math.round((new Date(due).getTime() - parseDateInput(today).getTime()) / DAY)
}

export const isTaskOverdue = (t: Pick<TaskItem, "status" | "dueDate">, today: string) =>
  t.status !== "DONE" && !!t.dueDate && toDateInput(t.dueDate) < today

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

/** "Due 3 Oct 2026" · "Due today" (orange) · "Overdue 2d" (red). */
export function DueLabel({ task, today, className }: { task: Pick<TaskItem, "status" | "dueDate">; today: string; className?: string }) {
  if (!task.dueDate) return null
  const left = daysLeft(task.dueDate, today)
  const open = task.status !== "DONE"
  if (open && left < 0)
    return (
      <span className={cn("text-danger inline-flex items-center gap-1 font-medium tabular-nums", className)}>
        <TriangleAlert aria-hidden className="size-3.5" /> Overdue {-left}d
        <span className="sr-only">(due {formatDate(task.dueDate)})</span>
      </span>
    )
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1 tabular-nums",
        open && left <= 1 && "text-brand-strong font-medium",
        className
      )}
    >
      <CalendarDays aria-hidden className="size-3.5" />
      {open && left === 0 ? "Due today" : open && left === 1 ? "Due tomorrow" : formatDate(task.dueDate)}
    </span>
  )
}

export function AssigneeChip({ assignee, compact }: { assignee: TaskItem["assignee"]; compact?: boolean }) {
  if (!assignee) return <span className="text-muted-foreground text-xs italic">Unassigned</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs" title={assignee.name}>
      <span
        aria-hidden
        className="bg-muted text-muted-foreground ring-border grid size-5 shrink-0 place-items-center rounded-[4px] font-mono text-[9px] font-semibold ring-1"
      >
        {initials(assignee.name)}
      </span>
      <span className={cn("truncate", compact && "sr-only")}>{assignee.name}</span>
    </span>
  )
}

/** Checklist tick for admins: flips instantly, the server confirms (toast on error rolls it back). */
export function DoneToggle({ task }: { task: Pick<TaskItem, "id" | "title" | "status"> }) {
  const [done, setDone] = useOptimistic(task.status === "DONE")
  const [, startTransition] = useTransition()
  return (
    <Checkbox
      checked={done}
      aria-label={task.title}
      className="mt-0.5 size-[18px]"
      onCheckedChange={(v) =>
        startTransition(async () => {
          setDone(v === true)
          await runAction(setTaskDone({ id: task.id, done: v === true }), v === true ? "Task done" : "Task reopened")
        })
      }
    />
  )
}

/** One checklist line: tick · title (opens edit for admins) · status · priority · assignee · due. */
export function TaskRow({
  task,
  today,
  admin,
  onEdit,
  showProject,
  showAssignee = true,
}: {
  task: TaskItem
  today: string
  admin: boolean
  onEdit?: (task: TaskItem) => void
  showProject?: boolean
  /** Off when the list is already grouped by person. */
  showAssignee?: boolean
}) {
  const done = task.status === "DONE"
  const overdue = isTaskOverdue(task, today)
  return (
    <li
      className={cn(
        "hover:bg-muted/40 flex items-start gap-3 border-b px-4 py-3 last:border-b-0",
        overdue && "shadow-[inset_2px_0_0_var(--danger)]"
      )}
    >
      {admin ? <DoneToggle task={task} /> : <TaskStatusIcon status={task.status} className="mt-0.5 size-[18px]" />}
      <div className="grid min-w-0 flex-1 gap-1.5 sm:flex sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className={cn(
                "hover:text-brand-strong rounded-sm text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                done && "text-muted-foreground line-through decoration-1"
              )}
            >
              {task.title}
            </button>
          ) : (
            <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through decoration-1")}>{task.title}</p>
          )}
          {showProject && task.project && (
            <Link href={`/projects/${task.project.id}`} className="text-muted-foreground hover:text-foreground block truncate text-xs">
              {task.project.title}
            </Link>
          )}
          {task.description && !done && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{task.description}</p>
          )}
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:grid sm:shrink-0 sm:gap-3",
            showAssignee ? "sm:grid-cols-[6.5rem_5rem_8.5rem_7rem]" : "sm:grid-cols-[6.5rem_5rem_7rem]"
          )}
        >
          <span className="max-sm:empty:hidden">{task.status === "IN_PROGRESS" && <TaskStatusBadge status="IN_PROGRESS" />}</span>
          <span>
            <PriorityBadge priority={task.priority} />
          </span>
          {showAssignee && (
            <span className="min-w-0">
              <AssigneeChip assignee={task.assignee} />
            </span>
          )}
          <span className="sm:text-right">
            <DueLabel task={task} today={today} />
          </span>
        </div>
      </div>
    </li>
  )
}
