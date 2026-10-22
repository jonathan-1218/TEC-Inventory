import type { Metadata } from "next"
import { History } from "lucide-react"
import { DeleteUpdateButton } from "@/components/projects/detail-controls"
import { ProgressUpdateForm } from "@/components/projects/progress-update-form"
import { db } from "@/lib/db"
import { formatDate, toDateInput, todayNoonUTC } from "@/lib/dates"
import { requireTeam } from "@/lib/portal"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Team progress" }

export default async function TeamProgressPage() {
  const { projectId } = await requireTeam()
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      progressPercent: true,
      members: { select: { member: { select: { id: true, name: true } } }, orderBy: { member: { name: "asc" } } },
      tasks: { select: { status: true } },
      progressUpdates: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { updatedBy: { select: { name: true } } } },
    },
  })
  if (!project) return null
  const done = project.tasks.filter((t) => t.status === "DONE").length
  const tasksPercent = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : null
  const updates = project.progressUpdates

  return (
    <div className="grid gap-8">
      <div>
        <p className="eyebrow mb-2">{project.title}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Progress</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your project is at <span className="text-foreground font-semibold tabular-nums">{project.progressPercent}%</span>. It follows your latest update.
        </p>
      </div>

      <section className="bg-card rounded-2xl border p-6">
        <h2 className="font-display mb-4 text-lg font-extrabold">Post an update</h2>
        <ProgressUpdateForm
          projectId={projectId}
          today={toDateInput(todayNoonUTC())}
          currentPercent={project.progressPercent}
          suggestedPercent={tasksPercent}
          projectMembers={project.members.map((m) => m.member)}
          otherMembers={[]}
        />
      </section>

      <section>
        <h2 className="font-display mb-4 flex items-center gap-2 text-lg font-extrabold">
          <History className="text-muted-foreground size-4" /> History
        </h2>
        {updates.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-2xl border border-dashed p-10 text-center text-sm">No updates yet.</p>
        ) : (
          <ol className="border-border ms-2 grid gap-6 border-s">
            {updates.map((u, i) => {
              const prev = updates[i + 1]
              const delta = prev ? u.percentAtUpdate - prev.percentAtUpdate : null
              return (
                <li key={u.id} className="relative ps-6">
                  <span aria-hidden className="bg-brand ring-background absolute top-2 -start-[5px] size-2.5 rounded-[3px] ring-4" />
                  <div className="bg-card rounded-2xl border p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <time dateTime={toDateInput(u.date)} className="font-mono text-xs font-medium">
                        {formatDate(u.date)}
                      </time>
                      <span className="bg-brand/15 text-brand-strong rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
                        {u.percentAtUpdate}%
                      </span>
                      {delta !== null && delta !== 0 && (
                        <span className={cn("font-mono text-xs tabular-nums", delta > 0 ? "text-muted-foreground" : "text-brand-strong")}>
                          {delta > 0 ? "+" : "−"}
                          {Math.abs(delta)} pts
                        </span>
                      )}
                      <span className="ms-auto">
                        <DeleteUpdateButton id={u.id} />
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{u.note}</p>
                    {u.updatedBy && <p className="text-muted-foreground mt-2 text-xs">by {u.updatedBy.name}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
