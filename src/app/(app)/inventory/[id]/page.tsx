import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarClock, ExternalLink, FileText, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConditionBadge, IssuanceStatusBadge, ProjectStatusBadge, StockBadge } from "@/components/badges"
import { RangeToggle, TrendChart, parseRange } from "@/components/charts"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { ReturnDialog } from "@/components/return-dialog"
import { ComponentActions } from "@/components/inventory/component-actions"
import { STOCK_SEGMENTS, StockMeter, StockSwatch } from "@/components/inventory/stock-meter"
import { ExtendDueDialog } from "@/components/issuances/extend-due-dialog"
import { MemberAvatar } from "@/components/members/member-badges"
import { getComponentHistory } from "@/lib/analytics"
import { isAdmin } from "@/lib/auth"
import { daysOverdue, formatDate, formatTimestamp } from "@/lib/dates"
import { db } from "@/lib/db"
import { formatCurrency } from "@/lib/format"
import { CATEGORY_LABELS } from "@/lib/labels"
import { getComponentWithStock, getSelectOptions } from "@/lib/queries"
import { cn } from "@/lib/utils"

export async function generateMetadata(props: PageProps<"/inventory/[id]">): Promise<Metadata> {
  const { id } = await props.params
  const c = await db.component.findUnique({ where: { id }, select: { name: true } })
  return { title: c?.name ?? "Component not found" }
}

export default async function ComponentPage(props: PageProps<"/inventory/[id]">) {
  const { id } = await props.params
  const { range, days } = parseRange((await props.searchParams).range, "90d")
  const [c, options, issuances, usages, history, admin] = await Promise.all([
    getComponentWithStock(id),
    getSelectOptions(),
    db.issuance.findMany({
      where: { componentId: id },
      include: {
        issuedTo: { select: { id: true, name: true, rollNumber: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { issuedDate: "desc" },
    }),
    db.projectComponent.findMany({
      where: { componentId: id },
      include: { project: { select: { id: true, title: true, status: true } } },
      orderBy: { project: { title: "asc" } },
    }),
    getComponentHistory(id, days),
    isAdmin(),
  ])
  if (!c) notFound()

  const lateBy = (i: (typeof issuances)[number]) =>
    !i.returnedDate && i.expectedReturnDate ? Math.max(0, daysOverdue(i.expectedReturnDate)) : 0
  const open = issuances
    .filter((i) => !i.returnedDate)
    .sort(
      (a, b) =>
        lateBy(b) - lateBy(a) ||
        (a.expectedReturnDate?.getTime() ?? Infinity) - (b.expectedReturnDate?.getTime() ?? Infinity)
    )
  const returned = issuances
    .filter((i) => i.returnedDate)
    .sort((a, b) => Number(b.returnedDate) - Number(a.returnedDate))
  const issuedInRange = history.reduce((n, d) => n + d.issued, 0)

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid gap-3">
        <Link
          href="/inventory"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Inventory
        </Link>
        <PageHeader
          eyebrow={`Part · ${CATEGORY_LABELS[c.category]}`}
          title={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {c.name}
              <StockBadge status={c.stockStatus} />
            </span>
          }
          description={
            (c.modelNumber || c.location) && (
              <span className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                {c.modelNumber && (
                  <span>
                    <span className="text-muted-foreground">MODEL </span>
                    <span className="text-foreground">{c.modelNumber}</span>
                  </span>
                )}
                {c.location && (
                  <span>
                    <span className="text-muted-foreground">LOC </span>
                    <span className="text-foreground">{c.location}</span>
                  </span>
                )}
              </span>
            )
          }
        >
          <ComponentActions
            component={c}
            options={options}
            openIssuances={open.map((i) => ({
              id: i.id,
              quantity: i.quantity,
              expectedReturnDate: i.expectedReturnDate,
              member: i.issuedTo,
            }))}
          />
        </PageHeader>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <p className="eyebrow">Stock</p>
            <CardTitle>Stock breakdown</CardTitle>
            <CardDescription>
              Low-stock alert when <span className="font-mono">{c.lowStockThreshold}</span> or fewer are available.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-5xl leading-none font-bold tabular-nums">{c.quantityAvailable}</span>
              <span className="text-muted-foreground text-sm">
                of <span className="text-foreground font-mono">{c.quantityTotal}</span> units available
              </span>
            </p>
            <div className="grid gap-1.5">
              <StockMeter stock={c} threshold={c.lowStockThreshold} className="h-3.5" />
              {c.quantityTotal > c.lowStockThreshold && (
                <div className="relative h-4">
                  <span
                    className="text-brand-strong absolute -translate-x-1/2 font-mono text-[10px] whitespace-nowrap"
                    style={{ left: `${(c.lowStockThreshold / c.quantityTotal) * 100}%` }}
                  >
                    ▲ low ≤ {c.lowStockThreshold}
                  </span>
                </div>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-4">
              {STOCK_SEGMENTS.map((s, i) => (
                <div key={s.key} className="grid gap-0.5">
                  <dt className="eyebrow flex items-center gap-1.5">
                    <StockSwatch index={i} />
                    {s.label}
                  </dt>
                  <dd className="font-mono text-xl font-semibold tabular-nums">
                    {c[s.key]}
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      {c.quantityTotal ? Math.round((c[s.key] / c.quantityTotal) * 100) : 0}%
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:row-span-2">
          <CardHeader>
            <p className="eyebrow">Spec sheet</p>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {c.datasheetUrl ? (
              <Button variant="outline" asChild className="h-auto justify-start py-2">
                <a href={c.datasheetUrl} target="_blank" rel="noreferrer">
                  <FileText />
                  <span className="grid min-w-0 text-left">
                    <span>Datasheet</span>
                    <span className="text-muted-foreground truncate font-mono text-[11px] font-normal">
                      {c.datasheetUrl.replace(/^https?:\/\//, "")}
                    </span>
                  </span>
                  <ExternalLink className="text-muted-foreground ml-auto" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Button>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2.5 text-sm">No datasheet linked.</p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <Detail label="Description" className="col-span-2">
                {c.description ? <p className="whitespace-pre-wrap">{c.description}</p> : "—"}
              </Detail>
              <Detail label="Location">
                <span className="font-mono">{c.location ?? "—"}</span>
              </Detail>
              <Detail label="Low-stock level">
                <span className="font-mono tabular-nums">≤ {c.lowStockThreshold}</span>
              </Detail>
              <Detail label="Unit cost">
                <span className="font-mono tabular-nums">{formatCurrency(c.unitCost)}</span>
              </Detail>
              <Detail label="Total value">
                <span className="font-mono tabular-nums">
                  {formatCurrency(c.unitCost == null ? null : c.unitCost * c.quantityTotal)}
                </span>
              </Detail>
              <Detail label="Notes" className="col-span-2">
                {c.notes ? <p className="whitespace-pre-wrap">{c.notes}</p> : "—"}
              </Detail>
              <Detail label="Added">
                <span className="font-mono text-xs">{formatTimestamp(c.createdAt)}</span>
              </Detail>
              <Detail label="Updated">
                <span className="font-mono text-xs">{formatTimestamp(c.updatedAt)}</span>
              </Detail>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 has-[[data-pending]]:[&_[data-slot=chart]]:opacity-60">
          <CardHeader>
            <p className="eyebrow">Checkout history</p>
            <CardTitle>Issued vs returned</CardTitle>
            <CardDescription>
              Units per day, last {days} days · <span className="font-mono">{issuedInRange}</span> issued
            </CardDescription>
            <CardAction>
              <RangeToggle value={range} param="range" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={history}
              height={200}
              series={[
                { key: "issued", label: "Issued" },
                { key: "returned", label: "Returned" },
              ]}
              emptyMessage="Never checked out"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <p className="eyebrow">On loan</p>
            <CardTitle>Who has it now</CardTitle>
            <CardDescription>
              {open.length === 0
                ? "Nothing out — every unit is on the shelf or on the bench."
                : `${c.quantityIssued} unit${c.quantityIssued === 1 ? "" : "s"} across ${open.length} checkout${open.length === 1 ? "" : "s"}.`}
            </CardDescription>
          </CardHeader>
          {open.length > 0 && (
            <CardContent>
              <ul className="divide-y">
                {open.map((i) => {
                  const late = lateBy(i)
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                      <MemberAvatar name={i.issuedTo.name} />
                      <div className="min-w-0 flex-1 basis-48">
                        <Link href={`/members/${i.issuedTo.id}`} className="hover:text-brand-strong font-medium">
                          {i.issuedTo.name}
                        </Link>
                        <p className="text-muted-foreground font-mono text-xs tabular-nums">
                          {i.quantity}× · since {formatDate(i.issuedDate)}
                          {i.project && (
                            <>
                              {" · "}
                              <Link href={`/projects/${i.project.id}`} className="hover:text-foreground font-sans">
                                {i.project.title}
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-xs tabular-nums", late > 0 ? "text-danger" : "text-muted-foreground")}>
                          {i.expectedReturnDate ? `due ${formatDate(i.expectedReturnDate)}` : "no due date"}
                        </span>
                        <IssuanceStatusBadge returned={false} overdueDays={late} />
                        {admin && (
                          <>
                            <ExtendDueDialog
                              issuance={{
                                id: i.id,
                                componentName: c.name,
                                memberName: i.issuedTo.name,
                                expectedReturnDate: i.expectedReturnDate,
                              }}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label={`Extend due date for ${i.issuedTo.name}`}>
                                  <CalendarClock />
                                </Button>
                              }
                            />
                            <ReturnDialog
                              issuance={{ id: i.id, quantity: i.quantity, componentName: c.name, memberName: i.issuedTo.name }}
                              trigger={
                                <Button size="sm" variant="outline" aria-label={`Return from ${i.issuedTo.name}`}>
                                  Return
                                </Button>
                              }
                            />
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Bill of materials</p>
            <CardTitle>Used in projects</CardTitle>
            <CardDescription>Required vs. issued for each project.</CardDescription>
          </CardHeader>
          <CardContent>
            {usages.length === 0 ? (
              <p className="text-muted-foreground text-sm">Not required by any project yet.</p>
            ) : (
              <ul className="grid gap-3">
                {usages.map((u) => (
                  <li key={u.projectId} className="grid gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/projects/${u.project.id}`} className="hover:text-brand-strong min-w-0 text-sm font-medium">
                        {u.project.title}
                      </Link>
                      <ProjectStatusBadge status={u.project.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-[2px]">
                        <div
                          className="bg-brand h-full"
                          style={{ width: `${Math.min(100, (u.quantityIssued / Math.max(1, u.quantityRequired)) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs tabular-nums">
                        {u.quantityIssued}
                        <span className="text-muted-foreground">/{u.quantityRequired} issued</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b pb-4">
          <p className="eyebrow">Log</p>
          <CardTitle>Issuance history</CardTitle>
          <CardDescription className="font-mono text-xs">
            {open.length} open · {returned.length} returned
          </CardDescription>
        </CardHeader>
        {issuances.length === 0 ? (
          <CardContent className="py-6">
            <EmptyState icon={History} title="Never issued" description="Checkouts of this component will appear here." />
          </CardContent>
        ) : (
          <Table className="[&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead className="hidden md:table-cell">Project</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="hidden sm:table-cell">Issued</TableHead>
                <TableHead className="hidden sm:table-cell">Due</TableHead>
                <TableHead className="hidden sm:table-cell">Returned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...open, ...returned].map((i) => {
                const late = lateBy(i)
                return (
                  <TableRow key={i.id} className={cn(!!i.returnedDate && "text-muted-foreground")}>
                    <TableCell className={cn("border-l-2", late > 0 ? "border-l-danger" : "border-l-transparent")}>
                      <Link href={`/members/${i.issuedTo.id}`} className="text-foreground hover:text-brand-strong font-medium">
                        {i.issuedTo.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {i.project ? (
                        <Link href={`/projects/${i.project.id}`} className="hover:text-foreground">
                          {i.project.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{i.quantity}</TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{formatDate(i.issuedDate)}</TableCell>
                    <TableCell className={cn("hidden font-mono text-xs sm:table-cell", late > 0 && "text-danger font-medium")}>
                      {formatDate(i.expectedReturnDate)}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">{formatDate(i.returnedDate)}</TableCell>
                    <TableCell>
                      {i.returnedDate && i.conditionOnReturn ? (
                        <ConditionBadge condition={i.conditionOnReturn} />
                      ) : (
                        <IssuanceStatusBadge returned={!!i.returnedDate} overdueDays={late} />
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-64 truncate lg:table-cell" title={i.notes ?? undefined}>
                      {i.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function Detail({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
