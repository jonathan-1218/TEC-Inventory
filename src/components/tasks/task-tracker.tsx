"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ProjectStatus } from "@prisma/client"
import { ListChecks, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useIsAdmin } from "@/components/admin-context"
import { ProjectStatusBadge, TASK_STATUS_LABELS } from "@/components/badges"
import { ProgressRing } from "@/components/charts"
import { EmptyState } from "@/components/empty-state"
import { TaskRow, daysLeft, initials, isTaskOverdue, type TaskItem } from "@/components/tasks/task-parts"
import { cn } from "@/lib/utils"

export type TrackerFilters = {
  q: string
  status: "open" | "TODO" | "IN_PROGRESS" | "DONE" | "all"
  assignee: string // "all" | "none" | member id
  project: string // "all" | project id
  due: "any" | "overdue" | "week" | "none"
  group: "project" | "assignee"
}
export type TrackerProject = {
  id: string
  title: string
  status: ProjectStatus
  progressPercent: number
  team: { id: string; name: string } | null
}

const DEFAULTS: TrackerFilters = { q: "", status: "open", assignee: "all", project: "all", due: "any", group: "project" }
const PROJECT_ORDER: ProjectStatus[] = ["IN_PROGRESS", "PLANNING", "ON_HOLD", "COMPLETED", "DROPPED"]
const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

const dueThisWeek = (t: TaskItem, today: string) => {
  if (t.status === "DONE" || !t.dueDate) return false
  const d = daysLeft(t.dueDate, today)
  return d >= 0 && d <= 6
}

/** Cross-project task tracker: readouts that double as quick filters, filters in the URL, grouped lists. */
export function TaskTracker({
  tasks,
  projects,
  today,
  doneThisWeek,
  initial,
}: {
  tasks: TaskItem[]
  projects: TrackerProject[]
  today: string
  doneThisWeek: number
  initial: TrackerFilters
}) {
  const admin = useIsAdmin()
  const [f, setF] = useState(initial)

  function update(patch: Partial<TrackerFilters>) {
    const next = { ...f, ...patch }
    setF(next)
    // Shareable URL without a server round trip (Next syncs native history calls with its router).
    const params = new URLSearchParams()
    for (const k of Object.keys(DEFAULTS) as (keyof TrackerFilters)[]) {
      if (next[k] && next[k] !== DEFAULTS[k]) params.set(k, next[k])
    }
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  const open = tasks.filter((t) => t.status !== "DONE")
  const readouts: { key: string; label: string; value: number; patch: Partial<TrackerFilters>; danger?: boolean }[] = [
    { key: "open", label: "Open", value: open.length, patch: { status: "open", due: "any", assignee: "all" } },
    { key: "progress", label: "In progress", value: tasks.filter((t) => t.status === "IN_PROGRESS").length, patch: { status: "IN_PROGRESS", due: "any", assignee: "all" } },
    { key: "overdue", label: "Overdue", value: open.filter((t) => isTaskOverdue(t, today)).length, patch: { status: "open", due: "overdue", assignee: "all" }, danger: true },
    { key: "week", label: "Due this week", value: open.filter((t) => dueThisWeek(t, today)).length, patch: { status: "open", due: "week", assignee: "all" } },
    { key: "none", label: "Unassigned", value: open.filter((t) => !t.assignee).length, patch: { status: "open", due: "any", assignee: "none" } },
  ]
  const isOn = (patch: Partial<TrackerFilters>) =>
    (Object.keys(patch) as (keyof TrackerFilters)[]).every((k) => f[k] === patch[k])

  const people = useMemo(
    () =>
      [...new Map(tasks.flatMap((t) => (t.assignee ? [[t.assignee.id, t.assignee] as const] : []))).values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [tasks]
  )

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return tasks
      .filter(
        (t) =>
          (f.status === "all" || (f.status === "open" ? t.status !== "DONE" : t.status === f.status)) &&
          (f.assignee === "all" || (f.assignee === "none" ? !t.assignee : t.assignee?.id === f.assignee)) &&
          (f.project === "all" || t.projectId === f.project) &&
          (f.due === "any" ||
            (f.due === "overdue" && isTaskOverdue(t, today)) ||
            (f.due === "week" && dueThisWeek(t, today)) ||
            (f.due === "none" && !t.dueDate)) &&
          (!q || [t.title, t.description, t.project?.title, t.assignee?.name].some((s) => s?.toLowerCase().includes(q)))
      )
      .sort(
        (a, b) =>
          (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity) ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      )
  }, [tasks, f, today])

  const groups = useMemo(() => {
    if (f.group === "project") {
      return [...projects]
        .sort((a, b) => PROJECT_ORDER.indexOf(a.status) - PROJECT_ORDER.indexOf(b.status) || a.title.localeCompare(b.title))
        .map((p) => ({ key: p.id, project: p, person: null, tasks: shown.filter((t) => t.projectId === p.id) }))
        .filter((g) => g.tasks.length > 0)
    }
    return [...people, null]
      .map((person) => ({
        key: person?.id ?? "none",
        project: null,
        person,
        tasks: shown.filter((t) => (t.assignee?.id ?? null) === (person?.id ?? null)),
      }))
      .filter((g) => g.tasks.length > 0)
  }, [f.group, projects, people, shown])

  const filtered = (Object.keys(DEFAULTS) as (keyof TrackerFilters)[]).some((k) => k !== "group" && f[k] !== DEFAULTS[k])

  return (
    <div className="grid gap-5">
      {/* Readouts double as quick filters. */}
      <div className="bg-border grid grid-cols-3 gap-px overflow-hidden rounded-xl border lg:grid-cols-6">
        {readouts.map((r) => {
          const on = isOn(r.patch)
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={on}
              onClick={() => update(on ? { status: "open", due: "any", assignee: "all" } : r.patch)}
              className={cn(
                "bg-card hover:bg-muted focus-visible:ring-ring/50 relative grid content-start gap-1 p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset sm:p-4",
                on && "bg-brand-soft"
              )}
            >
              {on && <span aria-hidden className="bg-brand absolute inset-x-0 top-0 h-0.5" />}
              <span className="eyebrow max-sm:text-[10px]">{r.label}</span>
              <span
                className={cn(
                  "font-display text-3xl font-bold tabular-nums",
                  r.danger && r.value > 0 && "text-danger"
                )}
              >
                {r.value}
              </span>
            </button>
          )
        })}
        <div className="bg-card grid content-start gap-1 p-3 sm:p-4">
          <span className="eyebrow max-sm:text-[10px]">Done this week</span>
          <span className="font-display text-3xl font-bold tabular-nums">{doneThisWeek}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <InputGroup className="w-full sm:max-w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search tasks, projects, people…"
            aria-label="Search tasks"
          />
        </InputGroup>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <FilterSelect
            label="Status"
            value={f.status}
            onChange={(v) => update({ status: v as TrackerFilters["status"] })}
            options={[
              ["open", "Open (not done)"],
              ["TODO", TASK_STATUS_LABELS.TODO],
              ["IN_PROGRESS", TASK_STATUS_LABELS.IN_PROGRESS],
              ["DONE", TASK_STATUS_LABELS.DONE],
              ["all", "Any status"],
            ]}
          />
          <FilterSelect
            label="Due"
            value={f.due}
            onChange={(v) => update({ due: v as TrackerFilters["due"] })}
            options={[
              ["any", "Any due date"],
              ["overdue", "Overdue"],
              ["week", "Due this week"],
              ["none", "No due date"],
            ]}
          />
          <FilterSelect
            label="Assignee"
            value={f.assignee}
            onChange={(v) => update({ assignee: v })}
            options={[["all", "Everyone"], ["none", "Unassigned"], ...people.map((p) => [p.id, p.name] as [string, string])]}
          />
          <FilterSelect
            label="Project"
            value={f.project}
            onChange={(v) => update({ project: v })}
            options={[["all", "All projects"], ...projects.map((p) => [p.id, p.title] as [string, string])]}
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          value={f.group}
          onValueChange={(v) => v && update({ group: v as TrackerFilters["group"] })}
          aria-label="Group by"
          className="max-sm:w-full sm:ms-auto"
        >
          <ToggleGroupItem value="project" className="max-sm:h-11 max-sm:flex-1">
            By project
          </ToggleGroupItem>
          <ToggleGroupItem value="assignee" className="max-sm:h-11 max-sm:flex-1">
            By person
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="text-muted-foreground flex min-h-8 items-center gap-3 text-sm" aria-live="polite">
        <span>
          <span className="text-foreground font-mono tabular-nums">{shown.length}</span> {shown.length === 1 ? "task" : "tasks"}
          {groups.length > 0 && ` in ${groups.length} ${f.group === "project" ? "projects" : groups.length === 1 ? "group" : "groups"}`}
        </span>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => update({ ...DEFAULTS, group: f.group })}>
            <X /> Clear filters
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={tasks.length === 0 ? "No tasks yet" : "No tasks match"}
          description={
            tasks.length === 0
              ? "Tasks are added on each project's page. They'll all show up here."
              : "Try another filter, or clear them to see every open task."
          }
        />
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => {
            const late = g.tasks.filter((t) => isTaskOverdue(t, today)).length
            return (
              <section key={g.key} aria-labelledby={`g-${g.key}`} className="bg-card overflow-hidden rounded-xl border">
                <header className="bg-muted/30 flex items-center gap-3 border-b px-4 py-3">
                  {g.project ? (
                    <ProgressRing value={g.project.progressPercent} size="sm" label={`${g.project.title} progress`} />
                  ) : (
                    <span
                      aria-hidden
                      className="bg-muted text-muted-foreground ring-border grid size-8 place-items-center rounded-md font-mono text-xs font-semibold ring-1"
                    >
                      {g.person ? initials(g.person.name) : "?"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 id={`g-${g.key}`} className="truncate text-sm font-semibold">
                      {g.project ? (
                        <Link href={`/projects/${g.project.id}#tasks`} className="hover:text-brand-strong">
                          {g.project.title}
                        </Link>
                      ) : g.person ? (
                        <Link href={`/members/${g.person.id}`} className="hover:text-brand-strong">
                          {g.person.name}
                        </Link>
                      ) : (
                        "Unassigned"
                      )}
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      {g.project?.team?.name ?? (g.project ? "Independent" : "Across projects")}
                    </p>
                  </div>
                  {g.project && <ProjectStatusBadge status={g.project.status} className="max-sm:hidden" />}
                  <span className="text-muted-foreground text-right font-mono text-xs tabular-nums">
                    {g.tasks.length} {g.tasks.length === 1 ? "task" : "tasks"}
                    {late > 0 && <span className="text-danger block font-sans font-medium">{late} overdue</span>}
                  </span>
                </header>
                <ul>
                  {g.tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={today}
                      admin={admin}
                      showProject={f.group === "assignee"}
                      showAssignee={f.group === "project"}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full max-sm:h-11 sm:w-auto sm:min-w-36" aria-label={`Filter by ${label.toLowerCase()}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, text]) => (
          <SelectItem key={v} value={v}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
