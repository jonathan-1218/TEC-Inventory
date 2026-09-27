"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import type { ReturnCondition } from "@prisma/client"
import { AlarmClockCheck, History, PackageCheck, Search, SearchX, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsAdmin } from "@/components/admin-context"
import { ConditionBadge, IssuanceStatusBadge } from "@/components/badges"
import { EmptyState } from "@/components/empty-state"
import { ReturnDialog } from "@/components/return-dialog"
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
  /** > 0 when open and past the expected return date (computed on the server). */
  overdueDays: number
  component: { id: string; name: string; modelNumber: string | null }
  issuedTo: { id: string; name: string; rollNumber: string }
  project: { id: string; title: string } | null
}

const TABS = ["open", "overdue", "history"] as const
type Tab = (typeof TABS)[number]

// Breathing room at the table's outer edges.
const TABLE =
  "[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4"

const time = (d: Date | null) => (d ? new Date(d).getTime() : Infinity)

export function IssuancesView({ rows, initialQuery }: { rows: IssuanceRow[]; initialQuery: string }) {
  const searchParams = useSearchParams()
  const param = searchParams.get("tab") as Tab
  const tab: Tab = TABS.includes(param) ? param : "open"
  const [query, setQuery] = useState(initialQuery)
  const [member, setMember] = useState("all")

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

  const { open, overdue, history } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (...fields: (string | null | undefined)[]) =>
      fields.some((f) => f?.toLowerCase().includes(q))
    const matches = rows.filter(
      (r) =>
        (member === "all" || r.issuedTo.id === member) &&
        (!q ||
          hit(r.component.name, r.component.modelNumber, r.issuedTo.name, r.issuedTo.rollNumber, r.project?.title))
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
      history: matches
        .filter((r) => r.returnedDate)
        .sort((a, b) => time(b.returnedDate) - time(a.returnedDate)),
    }
  }, [rows, query, member])

  const filtering = query.trim() !== "" || member !== "all"
  const noMatches = (
    <EmptyState icon={SearchX} title="No matching issuances" description="Try a different search or member." />
  )

  return (
    <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="open">
            Checked out <Count n={open.length} />
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue <Count n={overdue.length} alert />
          </TabsTrigger>
          <TabsTrigger value="history">
            History <Count n={history.length} />
          </TabsTrigger>
        </TabsList>
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
        </div>
      </div>

      <TabsContent value="open">
        {open.length ? (
          <OpenTable rows={open} />
        ) : filtering ? (
          noMatches
        ) : (
          <EmptyState icon={PackageCheck} title="Nothing checked out" description="Every component is back on the shelf." />
        )}
      </TabsContent>
      <TabsContent value="overdue">
        {overdue.length ? (
          <OpenTable rows={overdue} />
        ) : filtering ? (
          noMatches
        ) : (
          <EmptyState
            icon={AlarmClockCheck}
            title="No overdue returns"
            description="Everything checked out is within its due date."
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

function Count({ n, alert }: { n: number; alert?: boolean }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        alert && n > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"
      )}
    >
      {n}
    </span>
  )
}

function ComponentCell({ c }: { c: IssuanceRow["component"] }) {
  return (
    <>
      <Link href={`/inventory/${c.id}`} className="font-medium hover:underline">
        {c.name}
      </Link>
      {c.modelNumber && <div className="text-muted-foreground text-xs">{c.modelNumber}</div>}
    </>
  )
}

function MemberCell({ m }: { m: IssuanceRow["issuedTo"] }) {
  return (
    <>
      <Link href={`/members/${m.id}`} className="hover:underline">
        {m.name}
      </Link>
      <div className="text-muted-foreground text-xs">{m.rollNumber}</div>
    </>
  )
}

function ProjectCell({ p }: { p: IssuanceRow["project"] }) {
  if (!p) return <span className="text-muted-foreground">—</span>
  return (
    <Link href={`/projects/${p.id}`} className="hover:underline">
      {p.title}
    </Link>
  )
}

function DueCell({ r }: { r: IssuanceRow }) {
  if (!r.expectedReturnDate) return <span className="text-muted-foreground">No due date</span>
  if (r.overdueDays <= 0) return <>{formatDate(r.expectedReturnDate)}</>
  return (
    <div className="text-red-600 dark:text-red-400">
      <div className="font-medium">{formatDate(r.expectedReturnDate)}</div>
      <div className="text-xs">
        {r.overdueDays} {r.overdueDays === 1 ? "day" : "days"} overdue
      </div>
    </div>
  )
}

function OpenTable({ rows }: { rows: IssuanceRow[] }) {
  const admin = useIsAdmin()
  return (
    <div className="rounded-xl border">
      <Table className={TABLE}>
        <TableHeader>
          <TableRow>
            <TableHead>Component</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Issued to</TableHead>
            <TableHead className="hidden md:table-cell">Project</TableHead>
            <TableHead className="hidden lg:table-cell">Issued</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="hidden sm:table-cell">Status</TableHead>
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
              <TableRow key={r.id} className={cn(late && "bg-red-500/5 hover:bg-red-500/10")}>
                <TableCell className={cn("min-w-40 border-l-2 whitespace-normal", late ? "border-l-red-500" : "border-l-transparent")}>
                  <ComponentCell c={r.component} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                <TableCell>
                  <MemberCell m={r.issuedTo} />
                </TableCell>
                <TableCell className="hidden min-w-36 whitespace-normal md:table-cell">
                  <ProjectCell p={r.project} />
                </TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">{formatDate(r.issuedDate)}</TableCell>
                <TableCell className="tabular-nums">
                  <DueCell r={r} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <IssuanceStatusBadge returned={false} overdueDays={r.overdueDays} />
                </TableCell>
                {admin && (
                  <TableCell className="text-right">
                    <ReturnDialog
                      issuance={{
                        id: r.id,
                        quantity: r.quantity,
                        componentName: r.component.name,
                        memberName: r.issuedTo.name,
                      }}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Return ${r.component.name} from ${r.issuedTo.name}`}
                        >
                          <Undo2 /> Return
                        </Button>
                      }
                    />
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
    <div className="rounded-xl border">
      <Table className={TABLE}>
        <TableHeader>
          <TableRow>
            <TableHead>Component</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Issued to</TableHead>
            <TableHead className="hidden md:table-cell">Project</TableHead>
            <TableHead className="hidden lg:table-cell">Issued</TableHead>
            <TableHead>Returned</TableHead>
            <TableHead className="hidden sm:table-cell">Condition</TableHead>
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="min-w-40 whitespace-normal">
                <ComponentCell c={r.component} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
              <TableCell>
                <MemberCell m={r.issuedTo} />
              </TableCell>
              <TableCell className="hidden min-w-36 whitespace-normal md:table-cell">
                <ProjectCell p={r.project} />
              </TableCell>
              <TableCell className="hidden tabular-nums lg:table-cell">{formatDate(r.issuedDate)}</TableCell>
              <TableCell className="tabular-nums">{formatDate(r.returnedDate)}</TableCell>
              <TableCell className="hidden sm:table-cell">
                {r.conditionOnReturn ? (
                  <ConditionBadge condition={r.conditionOnReturn} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
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
