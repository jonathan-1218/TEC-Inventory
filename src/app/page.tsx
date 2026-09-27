import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CornerDownLeft,
  FolderKanban,
  FolderPlus,
  History,
  PackageCheck,
  PackagePlus,
  PackageMinus,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ConditionBadge, ProjectStatusBadge, StockBadge } from "@/components/badges"
import { EmptyState } from "@/components/empty-state"
import { IssueDialog } from "@/components/issue-dialog"
import { PageHeader } from "@/components/page-header"
import { ReturnDialog } from "@/components/return-dialog"
import { isAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { APP_TIME_ZONE, daysOverdue, formatDate, parseDateInput, todayNoonUTC } from "@/lib/dates"
import { getComponentsWithStock, getSelectOptions } from "@/lib/queries"

export const metadata: Metadata = { title: "Dashboard" }

const FEED_SIZE = 12
const link = "font-medium underline-offset-4 hover:underline"
const person = { select: { id: true, name: true } }
const item = { select: { id: true, name: true } }
const project = { select: { id: true, title: true } }

type Activity = { key: string; date: Date; icon: LucideIcon; body: React.ReactNode; detail?: React.ReactNode }

export default async function DashboardPage() {
  const [options, components, projects, activeMembers, totalMembers, overdue, issued, returned, updates] =
    await Promise.all([
      // Issue-dialog options are only needed (and only sent) for admins.
      isAdmin().then((admin) => (admin ? getSelectOptions() : null)),
      getComponentsWithStock(),
      db.project.findMany({
        select: { id: true, title: true, status: true, progressPercent: true, targetDate: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      db.member.count({ where: { isActive: true } }),
      db.member.count(),
      // Same rule as isOverdue(): open and expected back before today.
      db.issuance.findMany({
        where: { returnedDate: null, expectedReturnDate: { lt: todayNoonUTC() } },
        orderBy: { expectedReturnDate: "asc" },
        include: { component: item, issuedTo: person },
      }),
      db.issuance.findMany({
        orderBy: { issuedDate: "desc" },
        take: FEED_SIZE * 2,
        include: { component: item, issuedTo: person, project },
      }),
      db.issuance.findMany({
        where: { returnedDate: { not: null } },
        orderBy: { returnedDate: "desc" },
        take: FEED_SIZE,
        include: { component: item, issuedTo: person },
      }),
      db.progressUpdate.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: FEED_SIZE,
        include: { project, updatedBy: person },
      }),
    ])
  const admin = options !== null

  const sum = (f: (c: (typeof components)[number]) => number) => components.reduce((n, c) => n + f(c), 0)
  const totalUnits = sum((c) => c.quantityTotal)
  const available = sum((c) => c.quantityAvailable)
  const issuedUnits = sum((c) => c.quantityIssued)
  const availablePct = available + issuedUnits ? Math.round((available / (available + issuedUnits)) * 100) : 0

  const lowStock = components
    .filter((c) => c.stockStatus !== "ok")
    .sort((a, b) => a.quantityAvailable - b.quantityAvailable)
  const activeProjects = projects
    .filter((p) => p.status === "IN_PROGRESS" || p.status === "PLANNING")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "IN_PROGRESS" ? -1 : 1))
  const onHold = projects.filter((p) => p.status === "ON_HOLD").length

  // ---- Recent activity ----
  const events: Activity[] = []
  const memberLink = (m: { id: string; name: string }) => (
    <Link href={`/members/${m.id}`} className={link}>
      {m.name}
    </Link>
  )
  const componentLink = (c: { id: string; name: string }) => (
    <Link href={`/inventory/${c.id}`} className={link}>
      {c.name}
    </Link>
  )
  const projectLink = (p: { id: string; title: string }) => (
    <Link href={`/projects/${p.id}`} className={link}>
      {p.title}
    </Link>
  )

  // ponytail: a partial return splits one checkout into rows sharing the same issue date, so merge them
  // back into one "checked out" event. Also merges two same-day checkouts of one item by one person.
  const checkouts = new Map<string, (typeof issued)[number]>()
  for (const i of issued) {
    const key = [i.componentId, i.issuedToMemberId, i.projectId, i.issuedDate.toISOString()].join("|")
    const prev = checkouts.get(key)
    checkouts.set(key, prev ? { ...prev, quantity: prev.quantity + i.quantity } : i)
  }
  for (const i of checkouts.values()) {
    events.push({
      key: `issued-${i.id}`,
      date: i.issuedDate,
      icon: PackageMinus,
      body: (
        <>
          {memberLink(i.issuedTo)} checked out {i.quantity}× {componentLink(i.component)}
          {i.project && <> for {projectLink(i.project)}</>}
        </>
      ),
    })
  }

  for (const i of returned) {
    events.push({
      key: `returned-${i.id}`,
      date: i.returnedDate!,
      icon: CornerDownLeft,
      body: (
        <>
          {memberLink(i.issuedTo)} returned {i.quantity}× {componentLink(i.component)}{" "}
          {i.conditionOnReturn && <ConditionBadge condition={i.conditionOnReturn} />}
        </>
      ),
    })
  }

  for (const u of updates) {
    events.push({
      key: `update-${u.id}`,
      date: u.date,
      icon: TrendingUp,
      body: (
        <>
          {projectLink(u.project)} progress updated to <span className="tabular-nums">{u.percentAtUpdate}%</span>
          {u.updatedBy && <> by {memberLink(u.updatedBy)}</>}
        </>
      ),
      detail: u.note,
    })
  }

  // Bulk imports (e.g. the seed) add many rows at once, so collapse additions per local calendar day,
  // dated at noon UTC like every other calendar date (same "today" as todayNoonUTC).
  for (const [day, added] of Map.groupBy(components, (c) => c.createdAt.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE }))) {
    const [first] = added
    events.push({
      key: `components-${day}`,
      date: parseDateInput(day),
      icon: PackagePlus,
      body:
        added.length === 1 ? (
          <>
            {componentLink(first)} added to inventory ({first.quantityTotal} units)
          </>
        ) : (
          <>
            <Link href="/inventory" className={link}>
              {added.length} components
            </Link>{" "}
            added to inventory ({added.reduce((n, c) => n + c.quantityTotal, 0)} units)
          </>
        ),
      detail: added.length > 1 && added.map((c) => c.name).join(", "),
    })
  }
  for (const [day, created] of Map.groupBy(projects, (p) => p.createdAt.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE }))) {
    events.push({
      key: `projects-${day}`,
      date: parseDateInput(day),
      icon: FolderPlus,
      body:
        created.length === 1 ? (
          <>Project {projectLink(created[0])} created</>
        ) : (
          <>
            {created.length} projects created:{" "}
            {created.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                {projectLink(p)}
              </span>
            ))}
          </>
        ),
    })
  }

  const activity = events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, FEED_SIZE)

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Dashboard" description="Inventory, checkouts and projects at a glance.">
        {options && (
          <>
            <IssueDialog
              options={options}
              trigger={
                <Button>
                  <ArrowUpRight /> Issue component
                </Button>
              }
            />
            <Button variant="outline" asChild>
              <Link href="/inventory">
                <Boxes /> Inventory
              </Link>
            </Button>
          </>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat href="/inventory" icon={Boxes} label="Components" value={components.length}>
          {totalUnits} units in total
        </Stat>
        <Stat href="/issuances" icon={PackageCheck} label="Available vs issued" value={available}>
          <span className="tabular-nums">available · {issuedUnits} issued</span>
          <Progress value={availablePct} className="mt-2" aria-label={`${availablePct}% of working units available`} />
        </Stat>
        <Stat href="/projects" icon={FolderKanban} label="Active projects" value={activeProjects.length}>
          {onHold} on hold
        </Stat>
        <Stat href="/members" icon={Users} label="Active members" value={activeMembers}>
          {totalMembers} total incl. inactive
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" /> Low stock
            </CardTitle>
            <CardDescription>Available / low-stock threshold</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/inventory">
                  Inventory <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {lowStock.length ? (
              <ul className="divide-y">
                {lowStock.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/inventory/${c.id}`} className={`${link} block truncate`}>
                        {c.name}
                      </Link>
                      {c.location && <p className="text-muted-foreground truncate text-xs">{c.location}</p>}
                    </div>
                    <span className="text-sm tabular-nums">
                      {c.quantityAvailable}
                      <span className="text-muted-foreground"> / {c.lowStockThreshold}</span>
                    </span>
                    <StockBadge status={c.stockStatus} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={PackageCheck} title="Everything is stocked" description="No component is at or below its threshold." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-red-600 dark:text-red-400" /> Overdue returns
            </CardTitle>
            <CardDescription>Checkouts past their expected return date</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/issuances?tab=overdue">
                  View all issuances <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {overdue.length ? (
              <ul className="divide-y">
                {overdue.map((i) => {
                  const days = daysOverdue(i.expectedReturnDate!)
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate text-sm">
                          {componentLink(i.component)}{" "}
                          <span className="text-muted-foreground tabular-nums">×{i.quantity}</span>
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {memberLink(i.issuedTo)} · due {formatDate(i.expectedReturnDate)}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-red-600 tabular-nums dark:text-red-400">
                        {days} {days === 1 ? "day" : "days"} overdue
                      </span>
                      {admin && (
                        <ReturnDialog
                          issuance={{
                            id: i.id,
                            quantity: i.quantity,
                            componentName: i.component.name,
                            memberName: i.issuedTo.name,
                          }}
                          trigger={
                            <Button size="sm" variant="outline">
                              Return
                            </Button>
                          }
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState icon={PackageCheck} title="Nothing overdue" description="Every checkout is within its return date." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length ? (
              <ul className="grid grid-cols-1 gap-4">
                {activity.map((a) => (
                  <li key={a.key} className="flex gap-3">
                    <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                      <a.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{a.body}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        <time dateTime={a.date.toISOString()}>{formatDate(a.date)}</time>
                        {a.detail && <> · {a.detail}</>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={History} title="No activity yet" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="size-4" /> Active projects
            </CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/projects">
                  All projects <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {activeProjects.length ? (
              <ul className="grid gap-2">
                {activeProjects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="hover:bg-muted -mx-2 grid gap-2 rounded-lg px-2 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{p.title}</span>
                        <ProjectStatusBadge status={p.status} />
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={p.progressPercent} aria-label={`${p.title} progress`} />
                        <span className="w-9 text-right text-xs tabular-nums">{p.progressPercent}%</span>
                      </div>
                      {p.targetDate && (
                        <span className="text-muted-foreground text-xs">Target {formatDate(p.targetDate)}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={FolderKanban} title="No active projects" description="Planning and in-progress projects show up here." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({
  href,
  icon: Icon,
  label,
  value,
  children,
}: {
  href: string
  icon: LucideIcon
  label: string
  value: number
  children: React.ReactNode
}) {
  return (
    <Link href={href} className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3">
      <Card size="sm" className="hover:bg-muted/50 h-full transition-colors">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Icon className="size-4" /> {label}
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">{children}</CardContent>
      </Card>
    </Link>
  )
}
