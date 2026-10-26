"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { ReturnCondition } from "@prisma/client"
import { AlarmClockCheck, CalendarCheck, CalendarClock, History, PackageCheck, Search, SearchX, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsAdmin } from "@/components/admin-context"
import { ConditionBadge, IssuanceStatusBadge } from "@/components/badges"
import { EmptyState } from "@/components/empty-state"
import { ReturnDialog } from "@/components/return-dialog"
import { ExtendDueDialog } from "@/components/issuances/extend-due-dialog"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

export type IssuanceRow = {
  id: string
  quantity: number
  issuedDate: Date
  expectedReturnDate: Date | null
  returnedDate: Date | null
  conditionOnReturn: ReturnCondition | null
  notes: string | null
  /** Days until the expected return (0 = today, < 0 = overdue); null without a due date. Computed on the server. */
  daysLeft: number | null
  /** > 0 when open and past the expected return date. */
  overdueDays: number
  component: { id: string; name: string; modelNumber: string | null }
  issuedTo: { id: string; name: string; rollNumber: string; guest: boolean }
  project: { id: string; title: string } | null
}

const TABS = ["open", "overdue", "due", "history"] as const
type Tab = (typeof TABS)[number]

// Breathing room at the table's outer edges.
const TABLE = "[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4"

const time = (d: Date | null) => (d ? new Date(d).getTime() : Infinity)

export function IssuancesView({
  rows,
  initialQuery,
  dueSoonDays,
}: {
  rows: IssuanceRow[]
  initialQuery: string
  /** "Due soon" = open, not overdue, due within this many days. */
  dueSoonDays: number
}) {
  const searchParams = useSearchParams()
  const param = searchParams.get("tab") as Tab
  const tab: Tab = TABS.includes(param) ? param : "open"
  const [query, setQuery] = useState(initialQuery)
  const [member, setMember] = useState("all")
  const [kind, setKind] = useState("all") // all | members | students

  // The URL is the source of truth for the tab, so /issuances?tab=overdue links work.
  // Native replaceState syncs useSearchParams without a server round trip.
  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    window.history.replaceState(null, "", `?${params}`)
  }

  const members = useMemo(
    () =>
      [...new Map(rows.map((r) => [r.issuedTo.id, r.issuedTo])).values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [rows]
  )

  const { open, overdue, due, history } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (...fields: (string | null | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(q))
    const matches = rows.filter(
      (r) =>
        (member === "all" || r.issuedTo.id === member) &&
        (kind === "all" || (kind === "students") === r.issuedTo.guest) &&
        (!q || hit(r.component.name, r.component.modelNumber, r.issuedTo.name, r.issuedTo.rollNumber, r.project?.title))
    )
    // Most overdue first, then soonest due (no due date last), then oldest checkout.
    const open = matches
      .filter((r) => !r.returnedDate)
      .sort(
        (a, b) =>
          b.overdueDays - a.overdueDays ||
          time(a.expectedReturnDate) - time(b.expectedReturnDate) ||
          time(a.issuedDate) - time(b.issuedDate)
      )
    return {
      open,
      overdue: open.filter((r) => r.overdueDays > 0),
      due: open.filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= dueSoonDays),
      history: matches.filter((r) => r.returnedDate).sort((a, b) => time(b.returnedDate) - time(a.returnedDate)),
    }
  }, [rows, query, member, kind, dueSoonDays])

  const filtering = query.trim() !== "" || member !== "all" || kind !== "all"
  const clear = () => {
    setQuery("")
    setMember("all")
    setKind("all")
  }
  const noMatches = (
    <EmptyState icon={SearchX} title="No matching issuances" description="Try a different search or member.">
      <Button variant="outline" onClick={clear}>
        Clear filters
      </Button>
    </EmptyState>
  )

  return (
    <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList variant="line" className="gap-4">
            <TabsTrigger value="open" className="px-0">
              Active <Count n={open.length} />
            </TabsTrigger>
            <TabsTrigger value="overdue" className="px-0">
              Overdue <Count n={overdue.length} tone="danger" />
            </TabsTrigger>
            <TabsTrigger value="due" className="px-0">
              Due soon <Count n={due.length} tone="brand" />
            </TabsTrigger>
            <TabsTrigger value="history" className="px-0">
              History <Count n={history.length} />
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex flex-wrap gap-2">
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Component, member, project…"
              aria-label="Search issuances"
            />
          </InputGroup>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by borrower type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="members">Club members</SelectItem>
              <SelectItem value="students">Students</SelectItem>
            </SelectContent>
          </Select>
          <Select value={member} onValueChange={setMember}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Filter by member">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtering && (
            <Button variant="ghost" onClick={clear}>
              <X /> Clear
            </Button>
          )}
        </div>
      </div>

      <TabsContent value="open">
        {open.length ? (
          <OpenTable rows={open} dueSoonDays={dueSoonDays} />
        ) : filtering ? (
          noMatches
        ) : (
          <EmptyState icon={PackageCheck} title="Nothing checked out" description="Every component is back on the shelf." />
        )}
      </TabsContent>
      <TabsContent value="overdue">
        {overdue.length ? (
          <OpenTable rows={overdue} dueSoonDays={dueSoonDays} />
        ) : filtering ? (
          noMatches
        ) : (
          <EmptyState icon={AlarmClockCheck} title="No overdue returns" description="Everything checked out is within its due date." />
        )}
      </TabsContent>
      <TabsContent value="due">
        {due.length ? (
          <OpenTable rows={due} dueSoonDays={dueSoonDays} />
        ) : filtering ? (
          noMatches
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="Nothing due soon"
            description={`No returns are due in the next ${dueSoonDays} days.`}
          />
        )}
      </TabsContent>
      <TabsContent value="history">
        {history.length ? (
          <HistoryTable rows={history} />
        ) : filtering ? (
          noMatches
        ) : (
          <EmptyState icon={History} title="No returns yet" description="Returned checkouts will show up here." />
        )}
      </TabsContent>
    </Tabs>
  )
}

function Count({ n, tone }: { n: number; tone?: "danger" | "brand" }) {
  const hot = tone && n > 0
  return (
    <span
      className={cn(
        "rounded-sm px-1 font-mono text-[11px] tabular-nums",
        !hot && "text-muted-foreground",
        hot && tone === "danger" && "bg-danger-soft text-danger font-semibold",
        hot && tone === "brand" && "bg-brand-soft text-brand-strong font-semibold"
      )}
    >
      {n}
    </span>
  )
}

function ComponentCell({ c }: { c: IssuanceRow["component"] }) {
  return (
    <>
      <Link href={`/inventory/${c.id}`} className="hover:text-brand-strong font-medium transition-colors">
        {c.name}
      </Link>
      {c.modelNumber && <div className="text-muted-foreground font-mono text-[11px]">{c.modelNumber}</div>}
    </>
  )
}

function MemberCell({ m }: { m: IssuanceRow["issuedTo"] }) {
  return (
    <>
      <Link href={`/members/${m.id}`} className="hover:text-brand-strong transition-colors">
        {m.name}
      </Link>
      <div className="text-muted-foreground font-mono text-[11px]">{m.rollNumber}</div>
    </>
  )
}

function ProjectCell({ p }: { p: IssuanceRow["project"] }) {
  if (!p) return <span className="text-muted-foreground">—</span>
  return (
    <Link href={`/projects/${p.id}`} className="hover:text-brand-strong transition-colors">
      {p.title}
    </Link>
  )
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`

function DueCell({ r, dueSoonDays }: { r: IssuanceRow; dueSoonDays: number }) {
  if (!r.expectedReturnDate || r.daysLeft == null) return <span className="text-muted-foreground text-xs">No due date</span>
  const date = <div className="font-mono text-xs tabular-nums">{formatDate(r.expectedReturnDate)}</div>
  if (r.overdueDays > 0)
    return (
      <div className="text-danger">
        {date}
        <div className="text-xs font-semibold">{plural(r.overdueDays, "day")} late</div>
      </div>
    )
  if (r.daysLeft <= dueSoonDays)
    return (
      <div>
        {date}
        <div className="text-brand-strong text-xs font-medium">
          {r.daysLeft === 0 ? "Due today" : r.daysLeft === 1 ? "Due tomorrow" : `In ${r.daysLeft} days`}
        </div>
      </div>
    )
  return date
}

function OpenTable({ rows, dueSoonDays }: { rows: IssuanceRow[]; dueSoonDays: number }) {
  const admin = useIsAdmin()
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table className={TABLE}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Component</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Qty</TableHead>
            <TableHead className="hidden sm:table-cell">Issued to</TableHead>
            <TableHead className="hidden xl:table-cell">Project</TableHead>
            <TableHead className="hidden md:table-cell">Issued</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="hidden xl:table-cell">Status</TableHead>
            {admin && (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const late = r.overdueDays > 0
            return (
              <TableRow key={r.id} className={cn(late && "bg-danger-soft/35 hover:bg-danger-soft/60")}>
                <TableCell className={cn("min-w-40 border-l-2 whitespace-normal", late ? "border-l-danger" : "border-l-transparent")}>
                  <ComponentCell c={r.component} />
                  <div className="text-muted-foreground mt-0.5 text-xs sm:hidden">
                    <span className="font-mono">{r.quantity}×</span> →{" "}
                    <Link href={`/members/${r.issuedTo.id}`}>{r.issuedTo.name}</Link>
                  </div>
                </TableCell>
                <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{r.quantity}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <MemberCell m={r.issuedTo} />
                </TableCell>
                <TableCell className="hidden min-w-36 whitespace-normal xl:table-cell">
                  <ProjectCell p={r.project} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden font-mono text-xs tabular-nums md:table-cell">
                  {formatDate(r.issuedDate)}
                </TableCell>
                <TableCell>
                  <DueCell r={r} dueSoonDays={dueSoonDays} />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <IssuanceStatusBadge returned={false} overdueDays={r.overdueDays} />
                </TableCell>
                {admin && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ExtendDueDialog
                        issuance={{
                          id: r.id,
                          componentName: r.component.name,
                          memberName: r.issuedTo.name,
                          expectedReturnDate: r.expectedReturnDate,
                        }}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Extend due date of ${r.component.name} for ${r.issuedTo.name}`}
                            title="Extend due date"
                          >
                            <CalendarClock />
                          </Button>
                        }
                      />
                      <ReturnDialog
                        issuance={{
                          id: r.id,
                          quantity: r.quantity,
                          componentName: r.component.name,
                          memberName: r.issuedTo.name,
                        }}
                        trigger={
                          <Button size="sm" variant="outline" aria-label={`Return ${r.component.name} from ${r.issuedTo.name}`}>
                            <Undo2 /> <span className="hidden sm:inline">Return</span>
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function HistoryTable({ rows }: { rows: IssuanceRow[] }) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table className={TABLE}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Component</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="hidden sm:table-cell">Issued to</TableHead>
            <TableHead className="hidden xl:table-cell">Project</TableHead>
            <TableHead className="hidden md:table-cell">Issued</TableHead>
            <TableHead>Returned</TableHead>
            <TableHead className="hidden sm:table-cell">Condition</TableHead>
            <TableHead className="hidden xl:table-cell">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="min-w-40 whitespace-normal">
                <ComponentCell c={r.component} />
                <div className="text-muted-foreground mt-0.5 text-xs sm:hidden">← {r.issuedTo.name}</div>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{r.quantity}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <MemberCell m={r.issuedTo} />
              </TableCell>
              <TableCell className="hidden min-w-36 whitespace-normal xl:table-cell">
                <ProjectCell p={r.project} />
              </TableCell>
              <TableCell className="text-muted-foreground hidden font-mono text-xs tabular-nums md:table-cell">
                {formatDate(r.issuedDate)}
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {formatDate(r.returnedDate)}
                {r.conditionOnReturn && r.conditionOnReturn !== "WORKING" && (
                  <div className="mt-1 sm:hidden">
                    <ConditionBadge condition={r.conditionOnReturn} />
                  </div>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {r.conditionOnReturn ? (
                  <ConditionBadge condition={r.conditionOnReturn} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                {r.notes ? (
                  <div className="text-muted-foreground max-w-48 truncate" title={r.notes}>
                    {r.notes}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
