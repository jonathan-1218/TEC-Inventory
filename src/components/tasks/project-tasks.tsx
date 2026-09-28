"use client"

import { useState } from "react"
import { Columns3, ListChecks, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useIsAdmin } from "@/components/admin-context"
import { PriorityBadge, TASK_STATUS_LABELS, TaskStatusIcon, type TaskStatus } from "@/components/badges"
import { EmptyState } from "@/components/empty-state"
import { Kanban } from "@/components/tasks/kanban"
import { TaskDialog, type TaskEditing } from "@/components/tasks/task-dialog"
import {
  AssigneeChip,
  DueLabel,
  TaskRow,
  isTaskOverdue,
  type MemberOption,
  type TaskItem,
} from "@/components/tasks/task-parts"
import { moveTask } from "@/app/actions/tasks"
import { runAction } from "@/lib/client"
import { cn } from "@/lib/utils"

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"]

/** The project's task board / checklist, with the add / edit dialog. `tasks` arrive sorted by (order, createdAt). */
export function ProjectTasks({
  projectId,
  tasks,
  today,
  projectMembers,
  otherMembers,
}: {
  projectId: string
  tasks: TaskItem[]
  today: string
  projectMembers: MemberOption[]
  otherMembers: MemberOption[]
}) {
  const admin = useIsAdmin()
  const [view, setView] = useState<"board" | "list">("board")
  const [editing, setEditing] = useState<TaskEditing>(null)
  const edit = admin ? (task: TaskItem) => setEditing({ task }) : undefined

  const count = (s: TaskStatus) => tasks.filter((t) => t.status === s).length
  const overdue = tasks.filter((t) => isTaskOverdue(t, today)).length

  const columns = STATUSES.map((s) => ({
    id: s,
    label: TASK_STATUS_LABELS[s],
    header: (
      <>
        <TaskStatusIcon status={s} className={cn(s === "IN_PROGRESS" && "text-brand")} />
        <h3 className="eyebrow text-foreground">{TASK_STATUS_LABELS[s]}</h3>
        {admin && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="order-last -me-1"
            aria-label={`Add task to ${TASK_STATUS_LABELS[s]}`}
            onClick={() => setEditing({ status: s })}
          >
            <Plus />
          </Button>
        )}
      </>
    ),
  }))

  return (
    <section id="tasks" aria-labelledby="tasks-title" className="bg-card min-w-0 scroll-mt-20 rounded-xl border">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b p-4">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <p className="eyebrow">Work breakdown</p>
          <h2 id="tasks-title" className="text-base font-semibold">
            Tasks
          </h2>
        </div>
        {tasks.length > 0 && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(v) => v && setView(v as "board" | "list")}
            aria-label="Task view"
          >
            <ToggleGroupItem value="board" aria-label="Board">
              <Columns3 /> Board
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Checklist">
              <ListChecks /> Checklist
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        {admin && (
          <Button variant="brand" onClick={() => setEditing({ status: "TODO" })}>
            <Plus /> Add task
          </Button>
        )}
        {tasks.length > 0 && <TaskMeter todo={count("TODO")} inProgress={count("IN_PROGRESS")} done={count("DONE")} overdue={overdue} />}
      </header>

      {tasks.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description={
              admin
                ? "Split the project into tasks. Their completion suggests the project's progress."
                : "The team hasn't broken this project into tasks yet."
            }
          />
        </div>
      ) : view === "board" ? (
        <div className="p-4">
          <Kanban
            columns={columns}
            items={tasks}
            columnOf={(t) => t.status}
            itemLabel={(t) => t.title}
            noun="task"
            emptyText={admin ? "Drop a task here" : "Nothing here"}
            disabled={!admin}
            onMove={async (t, column, index) => {
              const status = column as TaskStatus
              const res = await runAction(
                moveTask({ id: t.id, status, order: index }),
                t.status === status ? undefined : `Moved to ${TASK_STATUS_LABELS[status]}`
              )
              return res.ok
            }}
            renderCard={(t, handle) => <TaskCard task={t} handle={handle} today={today} onEdit={edit} />}
          />
        </div>
      ) : (
        <Checklist tasks={tasks} today={today} admin={admin} onEdit={edit} />
      )}

      {admin && (
        <TaskDialog
          projectId={projectId}
          editing={editing}
          onClose={() => setEditing(null)}
          projectMembers={projectMembers}
          otherMembers={otherMembers}
        />
      )}
    </section>
  )
}

/** Segmented done / in progress / to do bar with a plain-language readout. */
function TaskMeter({ todo, inProgress, done, overdue }: { todo: number; inProgress: number; done: number; overdue: number }) {
  const total = todo + inProgress + done
  const seg = (n: number) => `${(n / total) * 100}%`
  return (
    <div className="grid w-full gap-1.5">
      <div aria-hidden className="bg-muted flex h-1.5 overflow-hidden rounded-full">
        <span className="bg-foreground" style={{ width: seg(done) }} />
        <span className="bg-brand" style={{ width: seg(inProgress) }} />
      </div>
      <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
        <span>
          <span className="text-foreground font-mono tabular-nums">{done}</span> done
        </span>
        <span>
          <span className="text-foreground font-mono tabular-nums">{inProgress}</span> in progress
        </span>
        <span>
          <span className="text-foreground font-mono tabular-nums">{todo}</span> to do
        </span>
        {overdue > 0 && <span className="text-danger font-medium">{overdue} overdue</span>}
        <span className="ms-auto">
          Tasks say <span className="text-foreground font-mono tabular-nums">{Math.round((done / total) * 100)}%</span>
        </span>
      </p>
    </div>
  )
}

function TaskCard({
  task,
  handle,
  today,
  onEdit,
}: {
  task: TaskItem
  handle: React.ReactNode
  today: string
  onEdit?: (task: TaskItem) => void
}) {
  const done = task.status === "DONE"
  const overdue = isTaskOverdue(task, today)
  return (
    <article
      className={cn(
        "bg-card grid gap-2 rounded-lg border p-3",
        overdue && "border-danger/40 shadow-[inset_2px_0_0_var(--danger)]"
      )}
    >
      <div className="flex items-start gap-2">
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(task)}
            className={cn(
              "hover:text-brand-strong min-w-0 flex-1 rounded-sm text-left text-sm leading-snug font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              done && "text-muted-foreground"
            )}
          >
            {task.title}
          </button>
        ) : (
          <p className={cn("min-w-0 flex-1 text-sm leading-snug font-medium", done && "text-muted-foreground")}>{task.title}</p>
        )}
        {handle}
      </div>
      {task.description && !done && <p className="text-muted-foreground line-clamp-2 text-xs">{task.description}</p>}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
        <PriorityBadge priority={task.priority} />
        <DueLabel task={task} today={today} />
        <span className="ms-auto">
          <AssigneeChip assignee={task.assignee} compact />
        </span>
      </div>
    </article>
  )
}

function Checklist({
  tasks,
  today,
  admin,
  onEdit,
}: {
  tasks: TaskItem[]
  today: string
  admin: boolean
  onEdit?: (task: TaskItem) => void
}) {
  // In progress first, then to do; each keeps its board order.
  const open = [...tasks.filter((t) => t.status === "IN_PROGRESS"), ...tasks.filter((t) => t.status === "TODO")]
  const done = tasks.filter((t) => t.status === "DONE")
  return (
    <div>
      {open.length > 0 ? (
        <ul>
          {open.map((t) => (
            <TaskRow key={t.id} task={t} today={today} admin={admin} onEdit={onEdit} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground px-4 py-6 text-sm">Every task is done.</p>
      )}
      {done.length > 0 && (
        <details className="group border-t">
          <summary className="eyebrow hover:text-foreground flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="transition-transform group-open:rotate-90">
              ›
            </span>
            Done · {done.length}
          </summary>
          <ul className="border-t">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} today={today} admin={admin} onEdit={onEdit} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
