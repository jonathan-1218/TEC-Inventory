"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ProjectStatus } from "@prisma/client"
import { CalendarDays, Columns3, Cpu, FolderKanban, GanttChart, LayoutGrid, Search, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ProjectStatusBadge } from "@/components/badges"
import { ProgressRing } from "@/components/charts"
import { EmptyState } from "@/components/empty-state"
import { ProjectBoard, TaskTally } from "@/components/projects/project-board"
import { ProjectRoadmap } from "@/components/projects/project-roadmap"
import { formatDate } from "@/lib/dates"
import { STATUSES, STATUS_LABELS, TECH_STACK_KEYS, type TechStack } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { TeamOption } from "@/components/projects/project-form"

export type View = "grid" | "board" | "roadmap"

export type ProjectCardData = {
  id: string
  title: string
  description: string | null
  status: ProjectStatus
  progressPercent: number
  startDate: Date | null
  targetDate: Date | null
  targetOverdue: boolean
  team: TeamOption | null
  memberCount: number
  lastUpdate: Date | null
  techStack: TechStack
  componentCount: number
  unitsRequired: number
  unitsIssued: number
  tasks: { total: number; done: number; overdue: number }
}

const STATUS_ORDER: ProjectStatus[] = ["IN_PROGRESS", "PLANNING", "ON_HOLD", "COMPLETED", "DROPPED"]
const MAX_CHIPS = 5
const VIEW_OPTIONS = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "roadmap", label: "Roadmap", icon: GanttChart },
] as const

const tagsOf = (p: ProjectCardData) => [...new Set(TECH_STACK_KEYS.flatMap((k) => p.techStack[k]))]

export function ProjectList({
  projects,
  teams,
  initialView,
  initialStatus,
  today,
}: {
  projects: ProjectCardData[]
  teams: TeamOption[]
  initialView: View
  initialStatus: ProjectStatus | "all"
  /** "YYYY-MM-DD" from the server (roadmap today line). */
  today: string
}) {
  const [view, setView] = useState<View>(initialView)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ProjectStatus | "all">(initialStatus)
  const [team, setTeam] = useState("all")

  // View and status live in the URL, shareable without a server round trip (Next syncs native history calls).
  function setParam(key: string, value: string, fallback: string) {
    const params = new URLSearchParams(window.location.search)
    if (value === fallback) params.delete(key)
    else params.set(key, value)
    window.history.replaceState(null, "", params.size ? `?${params}` : window.location.pathname)
  }
  function changeView(v: View) {
    setView(v)
    setParam("view", v, "grid")
  }
  function changeStatus(s: ProjectStatus | "all") {
    setStatus(s)
    setParam("status", s, "all")
  }

  // Search + team filter first, so the status counts reflect them.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter(
      (p) =>
        (team === "all" || (team === "none" ? !p.team : p.team?.id === team)) &&
        (!q ||
          [p.title, p.description, p.team?.name, ...tagsOf(p)].some((f) => f?.toLowerCase().includes(q)))
    )
  }, [projects, query, team])

  const shown = useMemo(
    () =>
      base
        // The board's columns are the statuses, so it ignores the status filter.
        .filter((p) => view === "board" || status === "all" || p.status === status)
        .sort(
          (a, b) =>
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
            (a.targetDate?.getTime() ?? Infinity) - (b.targetDate?.getTime() ?? Infinity) ||
            a.title.localeCompare(b.title)
        ),
    [base, status, view]
  )

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Projects the club starts will show up here with their team, progress and tech stack."
      />
    )
  }

  return (
    // min-w-0: grid items default to min-width:auto, which would let the board's columns widen the page.
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, description, tech…"
            aria-label="Search projects"
          />
        </InputGroup>
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by team">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
            <SelectItem value="none">No team</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && changeView(v as View)}
          aria-label="View"
          className="w-full sm:ms-auto sm:w-auto"
        >
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} className="flex-1 max-sm:h-11 sm:flex-none">
              <Icon /> {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {view !== "board" && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={status}
          onValueChange={(v) => v && changeStatus(v as ProjectStatus | "all")}
          aria-label="Filter by status"
          className="flex-wrap"
        >
          {(["all", ...STATUSES] as const).map((s) => (
            <ToggleGroupItem key={s} value={s}>
              {s === "all" ? "All" : STATUS_LABELS[s]}
              <span className="text-muted-foreground tabular-nums">
                {s === "all" ? base.length : base.filter((p) => p.status === s).length}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {shown.length === 0 && view !== "board" ? (
        <EmptyState icon={Search} title="No matching projects" description="Try a different search, team or status." />
      ) : view === "board" ? (
        <ProjectBoard projects={shown} />
      ) : view === "roadmap" ? (
        <ProjectRoadmap projects={shown} today={today} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project: p }: { project: ProjectCardData }) {
  const tags = tagsOf(p)

  return (
    <article className="bg-card hover:border-foreground/25 relative flex flex-col gap-4 rounded-xl border p-5 transition-colors">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1.5 truncate">{p.team?.name ?? "Independent"}</p>
          <h2 className="line-clamp-2 text-base leading-snug font-semibold">
            {/* Stretched link: the whole card opens the project. */}
            <Link
              href={`/projects/${p.id}`}
              className="after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
            >
              {p.title}
            </Link>
          </h2>
        </div>
        <ProjectStatusBadge status={p.status} />
      </header>
      {p.description && <p className="text-muted-foreground line-clamp-2 text-sm">{p.description}</p>}
      <div className="flex items-center gap-4 border-y border-dashed py-3">
        <ProgressRing value={p.progressPercent} size="sm" label={`${p.title} progress`} />
        <div className="grid min-w-0 gap-1 text-xs">
          <TaskTally tasks={p.tasks} />
          <span className="text-muted-foreground">{p.lastUpdate ? `Updated ${formatDate(p.lastUpdate)}` : "No updates yet"}</span>
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3.5" />
          {p.startDate || p.targetDate ? (
            <>
              {formatDate(p.startDate)} →{" "}
              <span className={cn(p.targetOverdue && "text-danger font-medium")}>{formatDate(p.targetDate)}</span>
              {p.targetOverdue && <span className="sr-only">(past target date)</span>}
            </>
          ) : (
            "No dates set"
          )}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <Users className="size-3.5" />
          {p.memberCount} {p.memberCount === 1 ? "member" : "members"}
        </span>
        {p.componentCount > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <Cpu className="size-3.5" />
            {p.unitsIssued}/{p.unitsRequired} units issued
          </span>
        )}
      </div>
      {tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1">
          {tags.slice(0, MAX_CHIPS).map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
          {tags.length > MAX_CHIPS && <Badge variant="outline">+{tags.length - MAX_CHIPS} more</Badge>}
        </div>
      )}
    </article>
  )
}
