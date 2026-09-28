"use client"

import Link from "next/link"
import type { ProjectStatus } from "@prisma/client"
import { CalendarDays, ListChecks } from "lucide-react"
import { useIsAdmin } from "@/components/admin-context"
import { ProjectStatusBadge } from "@/components/badges"
import { ProgressRing } from "@/components/charts"
import { Kanban } from "@/components/tasks/kanban"
import type { ProjectCardData } from "@/components/projects/project-list"
import { updateProjectStatus } from "@/app/actions/projects"
import { runAction } from "@/lib/client"
import { formatDate } from "@/lib/dates"
import { STATUSES, STATUS_LABELS } from "@/lib/labels"
import { cn } from "@/lib/utils"

const COLUMNS = STATUSES.map((s) => ({ id: s, label: STATUS_LABELS[s], header: <ProjectStatusBadge status={s} /> }))

/** Kanban by project status. Admins drag a card (or its grip, with the keyboard) to change status. */
export function ProjectBoard({ projects }: { projects: ProjectCardData[] }) {
  const admin = useIsAdmin()
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-muted-foreground text-xs">
        {admin
          ? "Drag a card by its grip to change the project's status. Keyboard: focus the grip, press space, use the arrow keys, press space to drop."
          : "Projects by status. Log in as admin to move them."}
      </p>
      <Kanban
        columns={COLUMNS}
        items={projects}
        columnOf={(p) => p.status}
        itemLabel={(p) => p.title}
        noun="project"
        emptyText="No projects"
        disabled={!admin}
        reorder={false}
        onMove={async (p, column) => {
          const status = column as ProjectStatus
          const res = await runAction(updateProjectStatus({ id: p.id, status }), `${p.title} → ${STATUS_LABELS[status]}`)
          return res.ok
        }}
        className="sm:auto-cols-[minmax(13rem,1fr)]"
        renderCard={(p, handle) => <BoardCard project={p} handle={handle} />}
      />
    </div>
  )
}

function BoardCard({ project: p, handle }: { project: ProjectCardData; handle: React.ReactNode }) {
  return (
    <article className={cn("bg-card grid gap-3 rounded-lg border p-3", p.status === "DROPPED" && "opacity-70")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1 truncate text-[10px]">{p.team?.name ?? "Independent"}</p>
          <Link
            href={`/projects/${p.id}`}
            className={cn(
              "hover:text-brand-strong line-clamp-2 text-sm leading-snug font-medium",
              p.status === "DROPPED" && "line-through"
            )}
          >
            {p.title}
          </Link>
        </div>
        {handle}
      </div>
      <div className="flex items-center gap-3">
        <ProgressRing value={p.progressPercent} size="sm" label={`${p.title} progress`} />
        <div className="grid min-w-0 gap-1 text-xs">
          <TaskTally tasks={p.tasks} />
          <span className={cn("text-muted-foreground flex items-center gap-1", p.targetOverdue && "text-danger font-medium")}>
            <CalendarDays aria-hidden className="size-3.5" />
            {p.targetDate ? `Target ${formatDate(p.targetDate)}` : "No target date"}
            {p.targetOverdue && <span className="sr-only">(past target)</span>}
          </span>
        </div>
      </div>
    </article>
  )
}

/** "12/20 tasks · 2 overdue" — shared by grid and board cards. */
export function TaskTally({ tasks }: { tasks: ProjectCardData["tasks"] }) {
  if (tasks.total === 0) return <span className="text-muted-foreground">No tasks yet</span>
  return (
    <span className="text-muted-foreground inline-flex flex-wrap items-center gap-x-1.5">
      <ListChecks aria-hidden className="size-3.5" />
      <span>
        <span className="text-foreground font-mono tabular-nums">
          {tasks.done}/{tasks.total}
        </span>{" "}
        tasks done
      </span>
      {tasks.overdue > 0 && <span className="text-danger font-medium">· {tasks.overdue} overdue</span>}
    </span>
  )
}
