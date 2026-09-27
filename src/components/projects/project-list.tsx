"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ProjectStatus } from "@prisma/client"
import { CalendarDays, Cpu, FolderKanban, Search, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ProjectStatusBadge } from "@/components/badges"
import { EmptyState } from "@/components/empty-state"
import { formatDate } from "@/lib/dates"
import { STATUSES, STATUS_LABELS, TECH_STACK_KEYS, type TechStack } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { TeamOption } from "@/components/projects/project-form"

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
}

const STATUS_ORDER: ProjectStatus[] = ["IN_PROGRESS", "PLANNING", "ON_HOLD", "COMPLETED", "DROPPED"]
const MAX_CHIPS = 5

const tagsOf = (p: ProjectCardData) => [...new Set(TECH_STACK_KEYS.flatMap((k) => p.techStack[k]))]

export function ProjectList({ projects, teams }: { projects: ProjectCardData[]; teams: TeamOption[] }) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ProjectStatus | "all">("all")
  const [team, setTeam] = useState("all")

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
        .filter((p) => status === "all" || p.status === status)
        .sort(
          (a, b) =>
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
            (a.targetDate?.getTime() ?? Infinity) - (b.targetDate?.getTime() ?? Infinity) ||
            a.title.localeCompare(b.title)
        ),
    [base, status]
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
    <div className="grid gap-4">
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
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={1}
        value={status}
        onValueChange={(v) => v && setStatus(v as ProjectStatus | "all")}
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

      {shown.length === 0 ? (
        <EmptyState icon={Search} title="No matching projects" description="Try a different search, team or status." />
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
    <Card className="hover:ring-foreground/25 relative transition-shadow">
      <CardHeader>
        <CardTitle className="line-clamp-2">
          {/* Stretched link: the whole card opens the project. */}
          <Link
            href={`/projects/${p.id}`}
            className="after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          >
            {p.title}
          </Link>
        </CardTitle>
        <CardAction>
          <ProjectStatusBadge status={p.status} />
        </CardAction>
        <CardDescription className="truncate">{p.team?.name ?? <span className="italic">Independent</span>}</CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 content-start gap-3">
        {p.description && <p className="text-muted-foreground line-clamp-2">{p.description}</p>}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {p.lastUpdate ? `Updated ${formatDate(p.lastUpdate)}` : "Progress"}
            </span>
            <span className="font-medium tabular-nums">{p.progressPercent}%</span>
          </div>
          <Progress value={p.progressPercent} aria-label={`${p.title} progress`} />
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {p.startDate || p.targetDate ? (
              <>
                {formatDate(p.startDate)} →{" "}
                <span className={cn(p.targetOverdue && "text-destructive font-medium")}>
                  {formatDate(p.targetDate)}
                </span>
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
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, MAX_CHIPS).map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
            {tags.length > MAX_CHIPS && <Badge variant="outline">+{tags.length - MAX_CHIPS} more</Badge>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
