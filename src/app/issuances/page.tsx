import type { Metadata } from "next"
import { AlarmClock, ClipboardList, PackageCheck, PackageOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { IssueDialog } from "@/components/issue-dialog"
import { PageHeader } from "@/components/page-header"
import { IssuancesView } from "@/components/issuances/issuances-view"
import { isAdmin } from "@/lib/auth"
import { daysOverdue, isOverdue, todayNoonUTC } from "@/lib/dates"
import { db } from "@/lib/db"
import { getSelectOptions } from "@/lib/queries"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Issuances" }

export default async function IssuancesPage(props: PageProps<"/issuances">) {
  const { q } = await props.searchParams
  const admin = await isAdmin()
  const [issuances, options] = await Promise.all([
    db.issuance.findMany({
      include: {
        component: { select: { id: true, name: true, modelNumber: true } },
        issuedTo: { select: { id: true, name: true, rollNumber: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    admin ? getSelectOptions() : null,
  ])

  // Overdue is computed on the server so client and server agree on "today".
  const rows = issuances.map((i) => ({
    ...i,
    overdueDays: isOverdue(i) && i.expectedReturnDate ? daysOverdue(i.expectedReturnDate) : 0,
  }))
  const open = rows.filter((r) => !r.returnedDate)
  const since = todayNoonUTC().getTime() - 30 * 86_400_000
  const stats = [
    { label: "Units out", value: open.reduce((n, r) => n + r.quantity, 0), icon: PackageOpen },
    { label: "Open checkouts", value: open.length, icon: ClipboardList },
    { label: "Overdue", value: open.filter((r) => r.overdueDays > 0).length, icon: AlarmClock, alert: true },
    {
      label: "Returned (last 30 days)",
      value: rows.filter((r) => r.returnedDate && r.returnedDate.getTime() >= since).length,
      icon: PackageCheck,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Issuances" description="Checkout log: who has what, and what's due back.">
        {options && (
          <IssueDialog
            options={options}
            trigger={
              <Button>
                <Plus /> Issue component
              </Button>
            }
          />
        )}
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const red = s.alert && s.value > 0
          return (
            <Card key={s.label} size="sm">
              <CardContent className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs">{s.label}</p>
                  <p className={cn("mt-1 text-2xl font-semibold tabular-nums", red && "text-red-600 dark:text-red-400")}>
                    {s.value}
                  </p>
                </div>
                <s.icon className={cn("size-4 shrink-0", red ? "text-red-600 dark:text-red-400" : "text-muted-foreground")} />
              </CardContent>
            </Card>
          )
        })}
      </div>
      <IssuancesView rows={rows} initialQuery={typeof q === "string" ? q.slice(0, 100) : ""} />
    </div>
  )
}
