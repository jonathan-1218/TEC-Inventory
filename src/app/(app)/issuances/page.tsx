import type { Metadata } from "next"
import { Download, HandHelping, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminOnly } from "@/components/admin-context"
import { IssueDialog } from "@/components/issue-dialog"
import { PageHeader } from "@/components/page-header"
import { RequestDialog } from "@/components/issuances/request-dialog"
import { RequestsPanel } from "@/components/issuances/requests-panel"
import { Readout } from "@/components/issuances/readout"
import { IssuancesView, type IssuanceRow } from "@/components/issuances/issuances-view"
import { getCheckoutSeries } from "@/lib/analytics"
import { isAdmin } from "@/lib/auth"
import { daysOverdue, formatDate } from "@/lib/dates"
import { db } from "@/lib/db"
import { getComponentsWithStock, getSelectOptions } from "@/lib/queries"

export const metadata: Metadata = { title: "Issuances" }

/** "Due soon" window, same as the dashboard's getDueSoon(3). */
const DUE_SOON_DAYS = 3

export default async function IssuancesPage(props: PageProps<"/issuances">) {
  const { q } = await props.searchParams
  const admin = await isAdmin()
  const [issuances, options, series, stock, requests] = await Promise.all([
    db.issuance.findMany({
      include: {
        component: { select: { id: true, name: true, modelNumber: true } },
        issuedTo: { select: { id: true, name: true, rollNumber: true, guest: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    admin ? getSelectOptions() : null,
    getCheckoutSeries(30),
    getComponentsWithStock(),
    admin ? db.componentRequest.findMany({ orderBy: { createdAt: "asc" }, include: { component: { select: { id: true, name: true } } } }) : [],
  ])
  const available = new Map(stock.map((c) => [c.id, c.quantityAvailable]))

  // Due/overdue is computed on the server so client and server agree on "today".
  const rows: IssuanceRow[] = issuances.map((i) => {
    const daysLeft = !i.returnedDate && i.expectedReturnDate ? -daysOverdue(i.expectedReturnDate) : null
    return { ...i, daysLeft, overdueDays: daysLeft != null && daysLeft < 0 ? -daysLeft : 0 }
  })
  const open = rows.filter((r) => !r.returnedDate)
  const overdue = open.filter((r) => r.overdueDays > 0)
  const dueSoon = open
    .filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= DUE_SOON_DAYS)
    .sort((a, b) => a.daysLeft! - b.daysLeft!)
  const unitsOut = open.reduce((n, r) => n + r.quantity, 0)
  const returned30 = series.reduce((n, d) => n + d.returned, 0)
  const worst = Math.max(0, ...overdue.map((r) => r.overdueDays))

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        eyebrow="Stock · Checkouts"
        title="Issuances"
        description="Who has what, and what's due back."
      >
        <AdminOnly>
          <Button variant="outline" asChild>
            <a href="/api/export/issuances" download>
              <Download /> Export CSV
            </a>
          </Button>
        </AdminOnly>
        <RequestDialog
          components={stock.map((c) => ({ id: c.id, name: c.name, modelNumber: c.modelNumber, quantityAvailable: c.quantityAvailable }))}
          trigger={
            <Button variant={options ? "outline" : "brand"}>
              <HandHelping /> Request a component
            </Button>
          }
        />
        {options && (
          <IssueDialog
            options={options}
            trigger={
              <Button variant="brand">
                <Plus /> Issue component
              </Button>
            }
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Readout
          label="Units out"
          value={unitsOut}
          context={`on ${open.length} checkout${open.length === 1 ? "" : "s"}`}
          spark={series.map((d) => d.onLoan)}
          summary={`Units on loan, last 30 days: now ${unitsOut}`}
        />
        <Readout
          label="Overdue"
          value={overdue.length}
          context={overdue.length ? `oldest ${worst} day${worst === 1 ? "" : "s"} late` : "all within due dates"}
          alert={overdue.length > 0}
        />
        <Readout
          label={`Due in ${DUE_SOON_DAYS} days`}
          value={dueSoon.length}
          context={dueSoon.length ? `next: ${dueSoon[0].component.name}, ${formatDate(dueSoon[0].expectedReturnDate)}` : "nothing coming up"}
        />
        <Readout
          label="Returned · 30d"
          value={returned30}
          context="units back on the shelf"
          spark={series.map((d) => d.returned)}
          summary={`Units returned per day, last 30 days: ${returned30} in total`}
        />
      </div>

      <RequestsPanel
        requests={requests.map((r) => ({
          id: r.id,
          name: r.name,
          rollNumber: r.rollNumber,
          department: r.department,
          yearOfStudy: r.yearOfStudy,
          quantity: r.quantity,
          component: r.component.name,
          available: available.get(r.componentId) ?? 0,
        }))}
      />

      <IssuancesView
        rows={rows}
        initialQuery={typeof q === "string" ? q.slice(0, 100) : ""}
        dueSoonDays={DUE_SOON_DAYS}
      />
    </div>
  )
}
