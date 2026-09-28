// Read-only aggregates for charts and dashboard panels. Server-side only (uses Prisma).
// Every query costs a round trip (~130 ms on a remote Supabase), so each function runs a fixed
// handful of queries in parallel — groupBy/aggregate or narrow selects, bucketed in JS, never per row.
// Series dates are "YYYY-MM-DD" in the club's time zone, oldest first, with every day present (zero-filled).
import type { Category, ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { calendarDay, parseDateInput, toDateInput, todayNoonUTC } from "@/lib/dates"
import { CATEGORY_LABELS } from "@/lib/labels"
import { getComponentsWithStock } from "@/lib/queries"

const DAY = 86_400_000
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
/** Calendar-date column (issued/expected/returned/update/due dates, stored at 12:00 UTC) -> "YYYY-MM-DD". */
const dateKey = (d: Date) => toDateInput(d)
/** Real timestamp (createdAt/completedAt) -> the club-local day it happened on. */
const tsKey = (d: Date) => toDateInput(calendarDay(d))

/** Projects counted as "active" (same as the dashboard): being planned or built. */
export const ACTIVE_STATUSES: ProjectStatus[] = ["PLANNING", "IN_PROGRESS"]
const CLOSED_STATUSES: ProjectStatus[] = ["COMPLETED", "DROPPED"]

// ---------- Series helpers (exported for scripts/check-stock.ts) ----------

/** The last `n` calendar days ending on `end` (default today), oldest first. */
export function dayKeys(n: number, end: Date = todayNoonUTC()): string[] {
  return Array.from({ length: n }, (_, i) => dateKey(addDays(end, i - n + 1)))
}

/** Per day in `keys`: sum of the weights of events on that day (days outside `keys` are ignored). */
export function sumByDay<T>(keys: string[], items: T[], event: (x: T) => [day: string | null, weight: number]): number[] {
  const index = new Map(keys.map((k, i) => [k, i]))
  const out = keys.map(() => 0)
  for (const x of items) {
    const [day, weight] = event(x)
    const i = day === null ? undefined : index.get(day)
    if (i !== undefined) out[i] += weight
  }
  return out
}

/** Per day in `keys`: sum of the weights of spans covering it at end of day (from <= day < to; null = open-ended). */
export function levelByDay<T>(
  keys: string[],
  items: T[],
  span: (x: T) => [from: string | null, to: string | null, weight: number]
): number[] {
  const out = keys.map(() => 0)
  for (const x of items) {
    const [from, to, weight] = span(x)
    keys.forEach((k, i) => {
      if ((from === null || from <= k) && (to === null || k < to)) out[i] += weight
    })
  }
  return out
}

export type SeriesPoint = { date: string; value: number }
const toSeries = (keys: string[], values: number[]): SeriesPoint[] => keys.map((date, i) => ({ date, value: values[i] }))

// ---------- KPIs ----------

/** `delta`: for levels (units, overdue, open tasks) today minus the day before the period; for activeMembers this period minus the previous one. */
export type Kpi = { value: number; delta: number | null; series: SeriesPoint[] }

export type Kpis = {
  periodDays: number
  /** Units owned (quantityTotal). Series rebuilt from lost returns. */
  totalUnits: Kpi
  /** Working units not on loan. */
  available: Kpi
  /** Units on open issuances. */
  issuedNow: Kpi
  /** Open issuances (records, not units) past their expected return date. */
  overdue: Kpi
  /** Projects in PLANNING or IN_PROGRESS. delta = null (status history isn't stored); series = project activity per day (progress updates + task completions). */
  activeProjects: Kpi
  /** Distinct members who checked out, returned, posted an update or completed a task in the period. Series = distinct per day. `roster` = members marked active. */
  activeMembers: Kpi & { roster: number }
  /** Tasks not DONE. Series rebuilt from createdAt/completedAt. */
  openTasks: Kpi
}

export async function getKpis(periodDays = 30): Promise<Kpis> {
  const today = todayNoonUTC()
  const keys = dayKeys(periodDays + 1, today) // keys[0] = baseline: the day before the period
  const periodKeys = keys.slice(1)
  const prevStart = addDays(today, 1 - 2 * periodDays)

  const [stock, issuances, tasks, updates, activeProjects, roster] = await Promise.all([
    db.component.aggregate({ _sum: { quantityTotal: true, quantityWorking: true } }),
    // Everything open at some point since the previous period started (the only rows that move these series).
    db.issuance.findMany({
      where: { OR: [{ returnedDate: null }, { returnedDate: { gte: prevStart } }] },
      select: {
        quantity: true,
        issuedDate: true,
        expectedReturnDate: true,
        returnedDate: true,
        conditionOnReturn: true,
        issuedToMemberId: true,
      },
    }),
    db.task.findMany({
      where: { OR: [{ completedAt: null }, { completedAt: { gte: addDays(prevStart, -1) } }] },
      select: { createdAt: true, completedAt: true, assigneeId: true },
    }),
    db.progressUpdate.findMany({ where: { date: { gte: prevStart } }, select: { date: true, updatedByMemberId: true } }),
    db.project.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    db.member.count({ where: { isActive: true } }),
  ])

  const returnedKey = (i: (typeof issuances)[number]) => (i.returnedDate ? dateKey(i.returnedDate) : null)
  const level = (values: number[]): Kpi => ({
    value: values[values.length - 1],
    delta: values[values.length - 1] - values[0],
    series: toSeries(periodKeys, values.slice(1)),
  })

  const onLoan = levelByDay(keys, issuances, (i) => [dateKey(i.issuedDate), returnedKey(i), i.quantity])
  // Units returned Damaged/Lost were still working before their return day; Lost ones also still owned.
  const unitsLeaving = (conditions: string[]) =>
    levelByDay(keys, issuances, (i) => [null, returnedKey(i), conditions.includes(i.conditionOnReturn ?? "") ? i.quantity : 0])
  const working = unitsLeaving(["DAMAGED", "LOST"]).map((n) => n + (stock._sum.quantityWorking ?? 0))
  const total = unitsLeaving(["LOST"]).map((n) => n + (stock._sum.quantityTotal ?? 0))
  // Same rule as isOverdue(): overdue from the day after the expected return date.
  const overdue = levelByDay(keys, issuances, (i) =>
    i.expectedReturnDate ? [dateKey(addDays(i.expectedReturnDate, 1)), returnedKey(i), 1] : [null, null, 0]
  )
  const openTasks = levelByDay(keys, tasks, (t) => [tsKey(t.createdAt), t.completedAt && tsKey(t.completedAt), 1])

  const acts: [day: string, memberId: string][] = []
  for (const i of issuances) {
    acts.push([dateKey(i.issuedDate), i.issuedToMemberId])
    if (i.returnedDate) acts.push([dateKey(i.returnedDate), i.issuedToMemberId])
  }
  for (const u of updates) if (u.updatedByMemberId) acts.push([dateKey(u.date), u.updatedByMemberId])
  for (const t of tasks) if (t.completedAt && t.assigneeId) acts.push([tsKey(t.completedAt), t.assigneeId])
  const distinct = (from: string, to: string) => new Set(acts.filter(([d]) => d >= from && d <= to).map(([, m]) => m)).size
  const membersNow = distinct(periodKeys[0], keys[keys.length - 1])

  const projectActivity = sumByDay(periodKeys, [...updates.map((u) => dateKey(u.date)), ...tasks.map((t) => t.completedAt && tsKey(t.completedAt))], (d) => [d, 1])

  return {
    periodDays,
    totalUnits: level(total),
    available: level(working.map((w, i) => w - onLoan[i])),
    issuedNow: level(onLoan),
    overdue: level(overdue),
    activeProjects: { value: activeProjects, delta: null, series: toSeries(periodKeys, projectActivity) },
    activeMembers: {
      value: membersNow,
      delta: membersNow - distinct(dateKey(prevStart), keys[0]),
      series: toSeries(periodKeys, periodKeys.map((k) => distinct(k, k))),
      roster,
    },
    openTasks: level(openTasks),
  }
}

// ---------- Checkouts ----------

/** Units issued and returned that day, and units out on loan at the end of it. */
export type CheckoutPoint = { date: string; issued: number; returned: number; onLoan: number }

/** Daily checkout activity for the last `days` days (optionally one component). Fetch 90 once and slice for 7/30. */
export async function getCheckoutSeries(days = 30, componentId?: string): Promise<CheckoutPoint[]> {
  const keys = dayKeys(days)
  const rows = await db.issuance.findMany({
    where: { componentId, OR: [{ returnedDate: null }, { returnedDate: { gte: parseDateInput(keys[0]) } }] },
    select: { quantity: true, issuedDate: true, returnedDate: true },
  })
  const returnedKey = (r: (typeof rows)[number]) => (r.returnedDate ? dateKey(r.returnedDate) : null)
  const issued = sumByDay(keys, rows, (r) => [dateKey(r.issuedDate), r.quantity])
  const returned = sumByDay(keys, rows, (r) => [returnedKey(r), r.quantity])
  const onLoan = levelByDay(keys, rows, (r) => [dateKey(r.issuedDate), returnedKey(r), r.quantity])
  return keys.map((date, i) => ({ date, issued: issued[i], returned: returned[i], onLoan: onLoan[i] }))
}

/** Checkout history of one component (inventory detail page). */
export function getComponentHistory(componentId: string, days = 90): Promise<CheckoutPoint[]> {
  return getCheckoutSeries(days, componentId)
}

// ---------- Inventory ----------

/** Units per category. available + issued = working; + damaged + underRepair = total. */
export type CategoryHealth = {
  category: Category
  label: string
  components: number
  total: number
  available: number
  issued: number
  damaged: number
  underRepair: number
}

/** Categories that have components, largest first. */
export async function getInventoryHealth(): Promise<CategoryHealth[]> {
  const byCategory = new Map<Category, CategoryHealth>()
  for (const c of await getComponentsWithStock()) {
    const h = byCategory.get(c.category) ?? {
      category: c.category,
      label: CATEGORY_LABELS[c.category],
      components: 0,
      total: 0,
      available: 0,
      issued: 0,
      damaged: 0,
      underRepair: 0,
    }
    h.components++
    h.total += c.quantityTotal
    h.available += c.quantityAvailable
    h.issued += c.quantityIssued
    h.damaged += c.quantityDamaged
    h.underRepair += c.quantityUnderRepair
    byCategory.set(c.category, h)
  }
  return [...byCategory.values()].sort((a, b) => b.total - a.total)
}

// ---------- Projects & teams ----------

export type ProjectProgress = {
  id: string
  title: string
  status: ProjectStatus
  progressPercent: number
  startDate: Date | null
  targetDate: Date | null
  team: { id: string; name: string } | null
  /** overdue = not done and due before today. Task completion (done / total) can suggest a progress %. */
  tasks: { todo: number; inProgress: number; done: number; total: number; overdue: number }
  /** One point per day with a progress update (the day's last update wins), oldest first. Not zero-filled. */
  series: { date: string; percent: number }[]
}

const STATUS_ORDER: ProjectStatus[] = ["IN_PROGRESS", "PLANNING", "ON_HOLD", "COMPLETED", "DROPPED"]

/** Every project: in progress first, then planning, on hold, completed, dropped; A–Z within a status. */
export async function getProjectProgress(): Promise<ProjectProgress[]> {
  const [projects, byStatus, overdue] = await Promise.all([
    db.project.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        progressPercent: true,
        startDate: true,
        targetDate: true,
        team: { select: { id: true, name: true } },
        progressUpdates: { select: { date: true, percentAtUpdate: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      },
    }),
    db.task.groupBy({ by: ["projectId", "status"], _count: { _all: true } }),
    db.task.groupBy({
      by: ["projectId"],
      where: { status: { not: "DONE" }, dueDate: { lt: todayNoonUTC() } },
      _count: { _all: true },
    }),
  ])
  const count = (projectId: string, status: TaskStatus) =>
    byStatus.find((r) => r.projectId === projectId && r.status === status)?._count._all ?? 0

  return projects
    .map(({ progressUpdates, ...p }) => {
      const todo = count(p.id, "TODO")
      const inProgress = count(p.id, "IN_PROGRESS")
      const done = count(p.id, "DONE")
      const series = new Map(progressUpdates.map((u) => [dateKey(u.date), u.percentAtUpdate]))
      return {
        ...p,
        tasks: {
          todo,
          inProgress,
          done,
          total: todo + inProgress + done,
          overdue: overdue.find((r) => r.projectId === p.id)?._count._all ?? 0,
        },
        series: [...series].map(([date, percent]) => ({ date, percent })),
      }
    })
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
}

export type TeamSnapshot = {
  id: string
  name: string
  members: number
  projects: number
  /** PLANNING or IN_PROGRESS. */
  activeProjects: number
  /** Mean progress of the team's projects that aren't completed or dropped; null if none. */
  avgProgress: number | null
  /** Units on open issuances tagged with the team's projects. */
  unitsOnLoan: number
  /** Tasks not done across the team's projects. */
  openTasks: number
}

/** One row per team, A–Z. */
export async function getTeamSnapshot(): Promise<TeamSnapshot[]> {
  const [teams, onLoan, openTasks] = await Promise.all([
    db.team.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
        projects: { select: { id: true, status: true, progressPercent: true } },
      },
    }),
    db.issuance.groupBy({ by: ["projectId"], where: { returnedDate: null, projectId: { not: null } }, _sum: { quantity: true } }),
    db.task.groupBy({ by: ["projectId"], where: { status: { not: "DONE" } }, _count: { _all: true } }),
  ])
  const loan = new Map(onLoan.map((r) => [r.projectId, r._sum.quantity ?? 0]))
  const tasks = new Map(openTasks.map((r) => [r.projectId, r._count._all]))
  return teams.map((t) => {
    const open = t.projects.filter((p) => !CLOSED_STATUSES.includes(p.status))
    return {
      id: t.id,
      name: t.name,
      members: t._count.members,
      projects: t.projects.length,
      activeProjects: t.projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length,
      avgProgress: open.length ? Math.round(open.reduce((n, p) => n + p.progressPercent, 0) / open.length) : null,
      unitsOnLoan: t.projects.reduce((n, p) => n + (loan.get(p.id) ?? 0), 0),
      openTasks: t.projects.reduce((n, p) => n + (tasks.get(p.id) ?? 0), 0),
    }
  })
}

// ---------- Activity ----------

/** issues = checkouts (rows split by partial returns count once), returns = return records, updates = progress updates, tasks = task completions. */
export type ActivityDay = { date: string; total: number; issues: number; returns: number; updates: number; tasks: number }

/**
 * Daily activity for a calendar heatmap: starts on the Monday `weeks - 1` weeks before this week's
 * Monday and ends today, so days.length = (weeks - 1) * 7 + days elapsed this week (1–7).
 * With `memberId`, only that member's checkouts/returns, updates they posted and tasks assigned to them.
 */
export async function getActivityHeatmap(weeks = 26, memberId?: string): Promise<ActivityDay[]> {
  const today = todayNoonUTC()
  const keys = dayKeys((weeks - 1) * 7 + ((today.getUTCDay() + 6) % 7) + 1, today)
  const start = parseDateInput(keys[0])
  const [issues, returns, updates, tasks] = await Promise.all([
    db.issuance.groupBy({
      by: ["issuedDate", "componentId", "issuedToMemberId"],
      where: { issuedDate: { gte: start }, issuedToMemberId: memberId },
    }),
    db.issuance.groupBy({
      by: ["returnedDate"],
      where: { returnedDate: { gte: start }, issuedToMemberId: memberId },
      _count: { _all: true },
    }),
    db.progressUpdate.groupBy({
      by: ["date"],
      where: { date: { gte: start }, updatedByMemberId: memberId },
      _count: { _all: true },
    }),
    db.task.findMany({
      where: { completedAt: { gte: addDays(start, -1) }, assigneeId: memberId },
      select: { completedAt: true },
    }),
  ])
  const i = sumByDay(keys, issues, (r) => [dateKey(r.issuedDate), 1])
  const r = sumByDay(keys, returns, (x) => [x.returnedDate && dateKey(x.returnedDate), x._count._all])
  const u = sumByDay(keys, updates, (x) => [dateKey(x.date), x._count._all])
  const t = sumByDay(keys, tasks, (x) => [x.completedAt && tsKey(x.completedAt), 1])
  return keys.map((date, n) => ({
    date,
    issues: i[n],
    returns: r[n],
    updates: u[n],
    tasks: t[n],
    total: i[n] + r[n] + u[n] + t[n],
  }))
}

/** One member's activity (member detail page); same shape as getActivityHeatmap. */
export function getMemberActivity(memberId: string, weeks = 26): Promise<ActivityDay[]> {
  return getActivityHeatmap(weeks, memberId)
}

// ---------- Due dates & headline ----------

/** daysLeft: 0 = due today, negative = overdue by that many days. */
export type DueIssuance = {
  id: string
  quantity: number
  expectedReturnDate: Date
  daysLeft: number
  component: { id: string; name: string }
  issuedTo: { id: string; name: string }
  project: { id: string; title: string } | null
}
export type DueTask = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: Date
  daysLeft: number
  project: { id: string; title: string }
  assignee: { id: string; name: string } | null
}

/**
 * Open issuances past due (most overdue first) or due within `days` days (soonest first), and
 * open tasks due within `days` days including overdue ones (earliest first, high priority first).
 */
export async function getDueSoon(days = 3): Promise<{ overdue: DueIssuance[]; dueSoon: DueIssuance[]; tasks: DueTask[] }> {
  const today = todayNoonUTC()
  const until = addDays(today, days)
  const [issuances, tasks] = await Promise.all([
    db.issuance.findMany({
      where: { returnedDate: null, expectedReturnDate: { lte: until } },
      orderBy: [{ expectedReturnDate: "asc" }, { issuedDate: "asc" }],
      select: {
        id: true,
        quantity: true,
        expectedReturnDate: true,
        component: { select: { id: true, name: true } },
        issuedTo: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    db.task.findMany({
      where: { status: { not: "DONE" }, dueDate: { lte: until } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
  ])
  const daysLeft = (d: Date) => Math.round((d.getTime() - today.getTime()) / DAY)
  const due = issuances.map((x) => ({ ...x, expectedReturnDate: x.expectedReturnDate!, daysLeft: daysLeft(x.expectedReturnDate!) }))
  return {
    overdue: due.filter((x) => x.daysLeft < 0),
    dueSoon: due.filter((x) => x.daysLeft >= 0),
    tasks: tasks.map((t) => ({ ...t, dueDate: t.dueDate!, daysLeft: daysLeft(t.dueDate!) })),
  }
}

/** Parts of the dashboard sentence, e.g. "3 returns overdue · 2 parts low on stock · 2 projects moving". */
export type StatusHeadline = {
  /** Open issuances past their expected return date. */
  overdue: number
  /** Components at or below their low-stock threshold, including out of stock. */
  lowStock: number
  outOfStock: number
  /** Projects IN_PROGRESS. */
  inProgress: number
  /** Open tasks due today through the next 6 days. */
  tasksDueThisWeek: number
  /** Open tasks due before today. */
  overdueTasks: number
}

export async function getStatusHeadline(): Promise<StatusHeadline> {
  const today = todayNoonUTC()
  const [overdue, components, inProgress, tasksDueThisWeek, overdueTasks] = await Promise.all([
    db.issuance.count({ where: { returnedDate: null, expectedReturnDate: { lt: today } } }),
    getComponentsWithStock(),
    db.project.count({ where: { status: "IN_PROGRESS" } }),
    db.task.count({ where: { status: { not: "DONE" }, dueDate: { gte: today, lte: addDays(today, 6) } } }),
    db.task.count({ where: { status: { not: "DONE" }, dueDate: { lt: today } } }),
  ])
  return {
    overdue,
    lowStock: components.filter((c) => c.stockStatus !== "ok").length,
    outOfStock: components.filter((c) => c.stockStatus === "out").length,
    inProgress,
    tasksDueThisWeek,
    overdueTasks,
  }
}
