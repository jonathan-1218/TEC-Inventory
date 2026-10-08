import Link from "next/link"
import { CheckCheck, Undo2 } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { PriorityBars, TaskStatusIcon } from "@/components/badges"
import { ReturnDialog } from "@/components/return-dialog"
import type { DueIssuance } from "@/lib/analytics"
import { toDateInput } from "@/lib/dates"
import { getComponentsWithStock } from "@/lib/queries"
import { db } from "@/lib/db"
import { getClubGoal, goalFor, goalStatus } from "@/lib/goals"
import { dueSoon } from "./data"
import { ExtendDue } from "./extend-due"
import { relDays } from "./util"

const TASK_LIMIT = 5

/** Overdue + due-soon returns (admin can return / extend in place), low stock, and tasks coming due. */
export async function AttentionBody({ admin }: { admin: boolean }) {
  const [due, components, projects, club] = await Promise.all([
    dueSoon(),
    getComponentsWithStock(),
    db.project.findMany({
      where: { status: { notIn: ["COMPLETED", "DROPPED"] } },
      select: { id: true, title: true, status: true, progressPercent: true, startDate: true, createdAt: true, goalPercent: true, goalDate: true },
    }),
    getClubGoal(),
  ])
  const behind = projects
    .map((p) => ({ p, g: goalStatus(p, goalFor(p, club)) }))
    .filter((x): x is { p: (typeof projects)[number]; g: NonNullable<typeof x.g> } => !!x.g?.behind)
    .sort((a, b) => b.g.behindBy - a.g.behindBy)
  const returns = [...due.overdue, ...due.dueSoon]
  const low = components
    .filter((c) => c.stockStatus !== "ok")
    .sort((a, b) => a.quantityAvailable / Math.max(1, a.lowStockThreshold) - b.quantityAvailable / Math.max(1, b.lowStockThreshold))

  if (!returns.length && !low.length && !due.tasks.length && !behind.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <CheckCheck className="size-5 text-muted-foreground" aria-hidden />
        <p className="font-medium">Nothing needs you right now</p>
        <p className="text-sm text-muted-foreground">No late returns, stock is healthy and no tasks are due.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {behind.length > 0 && (
        <Section title="Behind goal" note={`${behind.length} ${behind.length === 1 ? "project" : "projects"} below pace`} href="/projects">
          {behind.map(({ p, g }) => (
            <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2">
              <Led className="bg-danger" />
              <div className="min-w-0">
                <Link href={`/projects/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                  {p.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {g.missed ? `Missed ${g.percent}% goal` : `${g.behindBy} pts behind pace`} · goal {g.percent}%
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums">
                <b className="font-semibold text-danger">{p.progressPercent}%</b>
                <span className="text-muted-foreground">/{g.expected}%</span>
              </span>
            </li>
          ))}
        </Section>
      )}

      {returns.length > 0 && (
        <Section title="Returns" note={`${due.overdue.length} late · ${due.dueSoon.length} due in 3 days`} href="/issuances?tab=overdue">
          {returns.map((r) => (
            <ReturnRow key={r.id} r={r} admin={admin} />
          ))}
        </Section>
      )}

      {low.length > 0 && (
        <Section title="Low stock" note="available / threshold" href="/inventory?stock=low">
          {low.map((c) => {
            const out = c.quantityAvailable === 0
            return (
              <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2">
                <Led className={out ? "bg-brand" : "bg-brand/70 ring-2 ring-brand/20"} />
                <div className="min-w-0">
                  <Link href={`/inventory/${c.id}`} className="block truncate text-sm font-medium hover:underline">
                    {c.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{out ? "Out of stock" : (c.location ?? "No location")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span aria-hidden className="relative h-1 w-10 overflow-hidden rounded-full bg-muted">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-brand"
                      style={{ width: `${Math.min(100, (c.quantityAvailable / Math.max(1, c.lowStockThreshold)) * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 text-right font-mono text-xs tabular-nums">
                    <b className="font-semibold">{c.quantityAvailable}</b>
                    <span className="text-muted-foreground">/{c.lowStockThreshold}</span>
                  </span>
                </div>
              </li>
            )
          })}
        </Section>
      )}

      {due.tasks.length > 0 && (
        <Section id="attention-tasks" title="Tasks" note={`${due.tasks.length} due within 3 days or late`} href="/tasks?due=week">
          {due.tasks.slice(0, TASK_LIMIT).map((t) => (
            <li key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2">
              <TaskStatusIcon status={t.status} className={cn(t.status === "IN_PROGRESS" ? "text-brand" : "text-muted-foreground")} />
              <div className="min-w-0">
                <Link href={`/projects/${t.project.id}`} className="block truncate text-sm font-medium hover:underline">
                  {t.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {t.project.title}
                  {t.assignee && <> · {t.assignee.name}</>}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <DueLabel days={t.daysLeft} />
                <PriorityBars priority={t.priority} className={t.priority === "HIGH" ? "text-brand-strong" : "text-muted-foreground"} />
              </div>
            </li>
          ))}
          {due.tasks.length > TASK_LIMIT && (
            <li className="pt-2 font-mono text-[11px] text-muted-foreground">+{due.tasks.length - TASK_LIMIT} more on their project pages</li>
          )}
        </Section>
      )}
    </div>
  )
}

function ReturnRow({ r, admin }: { r: DueIssuance; admin: boolean }) {
  const late = r.daysLeft < 0
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2">
      <Led className={late ? "bg-danger" : "ring-[1.5px] ring-brand ring-inset"} />
      <div className="min-w-0">
        <p className="truncate text-sm">
          <Link href={`/inventory/${r.component.id}`} className="font-medium hover:underline">
            {r.component.name}
          </Link>{" "}
          <span className="font-mono text-xs text-muted-foreground">×{r.quantity}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <DueLabel days={r.daysLeft} /> ·{" "}
          <Link href={`/members/${r.issuedTo.id}`} className="hover:text-foreground hover:underline">
            {r.issuedTo.name}
          </Link>
        </p>
      </div>
      {admin && (
        <div className="flex items-center">
          <ReturnDialog
            issuance={{ id: r.id, quantity: r.quantity, componentName: r.component.name, memberName: r.issuedTo.name }}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Return ${r.component.name} from ${r.issuedTo.name}`} title="Record return">
                <Undo2 />
              </Button>
            }
          />
          <ExtendDue id={r.id} due={toDateInput(r.expectedReturnDate)} label={`${r.component.name} ×${r.quantity}, ${r.issuedTo.name}`} />
        </div>
      )}
    </li>
  )
}

/** "3d late" in danger red, "due today" / "due tomorrow" / "due in 2d" in orange text. */
function DueLabel({ days }: { days: number }) {
  return days < 0 ? (
    <span className="font-mono font-medium text-danger tabular-nums">{-days}d late</span>
  ) : (
    <span className="font-mono text-brand-strong tabular-nums">due {relDays(days)}</span>
  )
}

function Section({ id, title, note, href, children }: { id?: string; title: string; note: string; href?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
        <h3 className="eyebrow text-foreground">
          {href ? (
            <Link href={href} className="hover:text-brand-strong">
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{note}</span>
      </div>
      <ul className="divide-y divide-border/70">{children}</ul>
    </section>
  )
}

function Led({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} />
}
