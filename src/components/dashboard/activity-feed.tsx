import Link from "next/link"
import { CornerDownLeft, FolderPlus, PackagePlus, TrendingUp, ArrowUpRight, type LucideIcon } from "lucide-react"
import { cn } from "cn"
import { ConditionBadge } from "@/components/badges"
import { formatDayLong } from "@/components/charts"
import { db } from "@/lib/db"
import { APP_TIME_ZONE, parseDateInput, toDateInput, todayNoonUTC } from "@/lib/dates"
import { getComponentsWithStock } from "@/lib/queries"
import { daysBetween } from "./util"

const FEED_SIZE = 6
const link = "font-medium underline-offset-4 hover:underline"
const person = { select: { id: true, name: true } }
const item = { select: { id: true, name: true } }
const project = { select: { id: true, title: true } }

type Kind = "out" | "back" | "update" | "added"
type Activity = { key: string; date: Date; kind: Kind; body: React.ReactNode; detail?: React.ReactNode }

const KIND: Record<Kind, { icon: LucideIcon; label: string; className: string }> = {
  out: { icon: ArrowUpRight, label: "Checked out", className: "bg-brand-soft text-brand-strong ring-brand/30" },
  back: { icon: CornerDownLeft, label: "Returned", className: "bg-card text-foreground ring-border" },
  update: { icon: TrendingUp, label: "Progress", className: "bg-foreground text-background ring-foreground" },
  added: { icon: PackagePlus, label: "Added", className: "bg-muted text-muted-foreground ring-border" },
}

/** Latest checkouts, returns, progress updates and additions, as a day-grouped timeline. */
export async function ActivityFeed() {
  const [components, projects, issued, returned, updates] = await Promise.all([
    getComponentsWithStock(),
    db.project.findMany({ select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    db.issuance.findMany({ orderBy: { issuedDate: "desc" }, take: FEED_SIZE * 2, include: { component: item, issuedTo: person, project } }),
    db.issuance.findMany({
      where: { returnedDate: { not: null } },
      orderBy: { returnedDate: "desc" },
      take: FEED_SIZE,
      include: { component: item, issuedTo: person },
    }),
    db.progressUpdate.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: FEED_SIZE, include: { project, updatedBy: person } }),
  ])

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
      kind: "out",
      body: (
        <>
          {memberLink(i.issuedTo)} took {i.quantity}× {componentLink(i.component)}
          {i.project && <> for {projectLink(i.project)}</>}
        </>
      ),
    })
  }
  for (const i of returned) {
    events.push({
      key: `returned-${i.id}`,
      date: i.returnedDate!,
      kind: "back",
      body: (
        <>
          {memberLink(i.issuedTo)} returned {i.quantity}× {componentLink(i.component)}
        </>
      ),
      detail: i.conditionOnReturn && i.conditionOnReturn !== "WORKING" && <ConditionBadge condition={i.conditionOnReturn} />,
    })
  }
  for (const u of updates) {
    events.push({
      key: `update-${u.id}`,
      date: u.date,
      kind: "update",
      body: (
        <>
          {projectLink(u.project)} moved to <span className="font-mono font-semibold tabular-nums">{u.percentAtUpdate}%</span>
          {u.updatedBy && <> · {memberLink(u.updatedBy)}</>}
        </>
      ),
      detail: u.note,
    })
  }

  // Bulk imports (e.g. the seed) add many rows at once, so collapse additions per local calendar day,
  // dated at noon UTC like every other calendar date (same "today" as todayNoonUTC).
  const localDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE })
  for (const [day, added] of Map.groupBy(components, (c) => localDay(c.createdAt))) {
    const [first] = added
    events.push({
      key: `components-${day}`,
      date: parseDateInput(day),
      kind: "added",
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
  for (const [day, created] of Map.groupBy(projects, (p) => localDay(p.createdAt))) {
    events.push({
      key: `projects-${day}`,
      date: parseDateInput(day),
      kind: "added",
      body:
        created.length === 1 ? (
          <>New project {projectLink(created[0])}</>
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
  if (!activity.length) return <p className="py-8 text-center font-mono text-[13px] text-muted-foreground">No activity yet</p>

  const today = toDateInput(todayNoonUTC())
  const days = Map.groupBy(activity, (a) => toDateInput(a.date))

  return (
    <ol className="flex flex-col gap-4">
      {[...days].map(([day, items]) => (
        <li key={day}>
          <h3 className="eyebrow mb-2 flex items-center gap-2">
            {dayLabel(daysBetween(day, today), day)}
            <span aria-hidden className="h-px flex-1 bg-border" />
          </h3>
          <ol className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
            {items.map((a) => {
              const k = KIND[a.kind]
              const Icon = a.key.startsWith("projects-") ? FolderPlus : k.icon
              return (
                <li key={a.key} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3">
                  <span className={cn("z-[1] grid size-6 place-items-center rounded-[5px] ring-1", k.className)}>
                    <Icon className="size-3.5" aria-hidden />
                    <span className="sr-only">{k.label}</span>
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm leading-snug text-pretty">{a.body}</p>
                    {a.detail && <div className="mt-1 truncate text-[13px] text-muted-foreground">{a.detail}</div>}
                  </div>
                </li>
              )
            })}
          </ol>
        </li>
      ))}
    </ol>
  )
}

function dayLabel(ago: number, day: string) {
  if (ago === 0) return "Today"
  if (ago === 1) return "Yesterday"
  return formatDayLong(day).replace(/,? \d{4}$/, "")
}
