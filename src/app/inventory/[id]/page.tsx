import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CategoryBadge,
  ConditionBadge,
  IssuanceStatusBadge,
  ProjectStatusBadge,
  StockBadge,
} from "@/components/badges"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { ReturnDialog } from "@/components/return-dialog"
import { ComponentActions } from "@/components/inventory/component-actions"
import { isAdmin } from "@/lib/auth"
import { daysOverdue, formatDate, formatTimestamp } from "@/lib/dates"
import { db } from "@/lib/db"
import { formatCurrency } from "@/lib/format"
import { getComponentWithStock, getSelectOptions } from "@/lib/queries"
import { cn } from "@/lib/utils"

export async function generateMetadata(props: PageProps<"/inventory/[id]">): Promise<Metadata> {
  const { id } = await props.params
  const c = await db.component.findUnique({ where: { id }, select: { name: true } })
  return { title: c?.name ?? "Component not found" }
}

export default async function ComponentPage(props: PageProps<"/inventory/[id]">) {
  const { id } = await props.params
  const [c, options, issuances, usages, admin] = await Promise.all([
    getComponentWithStock(id),
    getSelectOptions(),
    db.issuance.findMany({
      where: { componentId: id },
      include: {
        issuedTo: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { issuedDate: "desc" },
    }),
    db.projectComponent.findMany({
      where: { componentId: id },
      include: { project: { select: { id: true, title: true, status: true } } },
      orderBy: { project: { title: "asc" } },
    }),
    isAdmin(),
  ])
  if (!c) notFound()

  const open = issuances.filter((i) => !i.returnedDate)
  const returned = issuances
    .filter((i) => i.returnedDate)
    .sort((a, b) => Number(b.returnedDate) - Number(a.returnedDate))

  const segments = [
    { label: "Available", value: c.quantityAvailable, color: "bg-emerald-500" },
    { label: "Issued", value: c.quantityIssued, color: "bg-sky-500" },
    { label: "Damaged", value: c.quantityDamaged, color: "bg-red-500" },
    { label: "Under repair", value: c.quantityUnderRepair, color: "bg-amber-500" },
  ]

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid gap-2">
        <Link
          href="/inventory"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Inventory
        </Link>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {c.name}
              <CategoryBadge category={c.category} />
              <StockBadge status={c.stockStatus} />
            </span>
          }
          description={[c.modelNumber, c.location].filter(Boolean).join(" · ") || undefined}
        >
          <ComponentActions component={c} options={options} openIssuances={open.length} />
        </PageHeader>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stock breakdown</CardTitle>
            <CardDescription>
              Low-stock alert when {c.lowStockThreshold} or fewer units are available.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Total" value={c.quantityTotal} />
              {segments.map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} color={s.color} />
              ))}
            </dl>
            <div
              className="bg-muted flex h-3 overflow-hidden rounded-full"
              role="img"
              aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}
            >
              {c.quantityTotal > 0 &&
                segments.map(
                  (s) =>
                    s.value > 0 && (
                      <div
                        key={s.label}
                        className={s.color}
                        style={{ width: `${(s.value / c.quantityTotal) * 100}%` }}
                        title={`${s.label}: ${s.value}`}
                      />
                    )
                )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Detail label="Description" className="col-span-2">
                {c.description ? <p className="whitespace-pre-wrap">{c.description}</p> : "—"}
              </Detail>
              <Detail label="Location">{c.location ?? "—"}</Detail>
              <Detail label="Low-stock threshold">
                <span className="tabular-nums">{c.lowStockThreshold}</span>
              </Detail>
              <Detail label="Unit cost">
                <span className="tabular-nums">{formatCurrency(c.unitCost)}</span>
              </Detail>
              <Detail label="Total value">
                <span className="tabular-nums">
                  {formatCurrency(c.unitCost == null ? null : c.unitCost * c.quantityTotal)}
                </span>
              </Detail>
              <Detail label="Datasheet" className="col-span-2">
                {c.datasheetUrl ? (
                  <a
                    href={c.datasheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{c.datasheetUrl.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  "—"
                )}
              </Detail>
              <Detail label="Notes" className="col-span-2">
                {c.notes ? <p className="whitespace-pre-wrap">{c.notes}</p> : "—"}
              </Detail>
              <Detail label="Added">{formatTimestamp(c.createdAt)}</Detail>
              <Detail label="Last updated">{formatTimestamp(c.updatedAt)}</Detail>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Used in projects</CardTitle>
            <CardDescription>Requirements and units currently issued per project.</CardDescription>
          </CardHeader>
          <CardContent>
            {usages.length === 0 ? (
              <p className="text-muted-foreground text-sm">Not required by any project yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usages.map((u) => (
                    <TableRow key={u.projectId}>
                      <TableCell>
                        <Link href={`/projects/${u.project.id}`} className="font-medium hover:underline">
                          {u.project.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ProjectStatusBadge status={u.project.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.quantityRequired}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.quantityIssued}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issuance history</CardTitle>
          <CardDescription>
            {open.length} open · {returned.length} returned
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issuances.length === 0 ? (
            <EmptyState icon={History} title="Never issued" description="Checkouts of this component will appear here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden md:table-cell">Project</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden sm:table-cell">Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="hidden sm:table-cell">Returned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                  {admin && (
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...open, ...returned].map((i) => {
                  const late = !i.returnedDate && i.expectedReturnDate ? daysOverdue(i.expectedReturnDate) : 0
                  return (
                    <TableRow key={i.id} className={cn(late > 0 && "bg-red-500/5", !!i.returnedDate && "text-muted-foreground")}>
                      <TableCell>
                        <Link href={`/members/${i.issuedTo.id}`} className="text-foreground font-medium hover:underline">
                          {i.issuedTo.name}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {i.project ? (
                          <Link href={`/projects/${i.project.id}`} className="hover:underline">
                            {i.project.title}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDate(i.issuedDate)}</TableCell>
                      <TableCell>{formatDate(i.expectedReturnDate)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDate(i.returnedDate)}</TableCell>
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
                      {admin && (
                        <TableCell className="text-right">
                          {!i.returnedDate && (
                            <ReturnDialog
                              issuance={{
                                id: i.id,
                                quantity: i.quantity,
                                componentName: c.name,
                                memberName: i.issuedTo.name,
                              }}
                              trigger={
                                <Button size="sm" variant="outline">
                                  Return
                                </Button>
                              }
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {color && <span className={cn("size-2 rounded-full", color)} aria-hidden />}
        {label}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Detail({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid min-w-0 gap-0.5", className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
