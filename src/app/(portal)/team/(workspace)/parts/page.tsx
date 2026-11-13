import type { Metadata } from "next"
import { HandHelping, PackageOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RequestDialog } from "@/components/issuances/request-dialog"
import { RemoveRequestButton } from "@/components/portal/remove-request"
import { IssuanceStatusBadge } from "@/components/badges"
import { db } from "@/lib/db"
import { daysOverdue, formatDate, isOverdue } from "@/lib/dates"
import { requireTeam } from "@/lib/portal"
import { getComponentsWithStock } from "@/lib/queries"

export const metadata: Metadata = { title: "Team parts" }

export default async function TeamPartsPage() {
  const { projectId } = await requireTeam()
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      members: { select: { memberId: true, member: { select: { name: true, isActive: true } } }, orderBy: { member: { name: "asc" } } },
      components: { select: { quantityRequired: true, quantityIssued: true, component: { select: { name: true } } }, orderBy: { component: { name: "asc" } } },
    },
  })
  if (!project) return null
  // Anything checked out for the project, or to one of its members.
  const loans = await db.issuance.findMany({
    where: { OR: [{ projectId }, { issuedToMemberId: { in: project.members.map((m) => m.memberId) } }] },
    include: { component: { select: { name: true } }, issuedTo: { select: { name: true } } },
    orderBy: [{ returnedDate: { sort: "desc", nulls: "first" } }, { issuedDate: "desc" }],
    take: 100,
  })
  const open = loans.filter((l) => !l.returnedDate)
  const [stock, requests] = await Promise.all([
    getComponentsWithStock(),
    db.componentRequest.findMany({ where: { projectId }, include: { component: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
  ])

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{project.title}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Parts</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {open.length} borrowed right now. Request what you need; a club admin approves it and records returns.
          </p>
        </div>
        <RequestDialog
          components={stock.map((c) => ({ id: c.id, name: c.name, modelNumber: c.modelNumber, quantityAvailable: c.quantityAvailable }))}
          team={{ projectId, members: project.members.filter((m) => m.member.isActive).map((m) => ({ id: m.memberId, name: m.member.name })) }}
          trigger={
            <Button variant="brand">
              <HandHelping /> Request a part
            </Button>
          }
        />
      </div>

      {requests.length > 0 && (
        <section>
          <h2 className="font-display mb-4 text-lg font-extrabold">Your requests</h2>
          <ul className="grid gap-3">
            {requests.map((r) => (
              <li key={r.id} className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-4">
                <span className="font-mono text-sm font-semibold tabular-nums">{r.quantity}×</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.component.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    for {r.name} · asked {formatDate(r.createdAt)}
                    {r.rejectedAt && ` · declined ${formatDate(r.rejectedAt)}`}
                  </p>
                </div>
                <span className={r.rejectedAt ? "text-danger text-xs font-medium" : "text-muted-foreground text-xs font-medium"}>
                  {r.rejectedAt ? "Declined" : "Waiting for approval"}
                </span>
                <RemoveRequestButton id={r.id} declined={!!r.rejectedAt} />
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-xs">An approved request moves to Borrowed parts below.</p>
        </section>
      )}

      {project.components.length > 0 && (
        <section className="bg-card rounded-2xl border p-6">
          <h2 className="font-display mb-4 text-lg font-extrabold">What the project needs</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {project.components.map((c) => {
              const pct = c.quantityRequired ? Math.min(100, Math.round((c.quantityIssued / c.quantityRequired) * 100)) : 0
              return (
                <li key={c.component.name} className="bg-muted/40 rounded-xl p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{c.component.name}</span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {c.quantityIssued} / {c.quantityRequired}
                    </span>
                  </div>
                  <div aria-hidden className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                    <div className="bg-brand h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display mb-4 text-lg font-extrabold">Borrowed parts</h2>
        {loans.length === 0 ? (
          <div className="bg-card text-muted-foreground flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-sm">
            <PackageOpen className="size-6" />
            Nothing borrowed yet.
          </div>
        ) : (
          <ul className="grid gap-3">
            {loans.map((l) => (
              <li key={l.id} className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border p-4">
                <span className="font-mono text-sm font-semibold tabular-nums">{l.quantity}×</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.component.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {l.issuedTo.name} · taken {formatDate(l.issuedDate)}
                    {l.returnedDate ? ` · returned ${formatDate(l.returnedDate)}` : l.expectedReturnDate ? ` · due ${formatDate(l.expectedReturnDate)}` : ""}
                  </p>
                </div>
                <IssuanceStatusBadge
                  returned={!!l.returnedDate}
                  overdueDays={!l.returnedDate && isOverdue(l) && l.expectedReturnDate ? daysOverdue(l.expectedReturnDate) : 0}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
