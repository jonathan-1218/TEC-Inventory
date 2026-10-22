import { Suspense } from "react"
import { ArrowUpRight, FolderPlus, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IssueDialog } from "@/components/issue-dialog"
import { ComponentFormDialog } from "@/components/inventory/component-form-dialog"
import { ProjectFormDialog } from "@/components/projects/project-form"
import { APP_TIME_ZONE, dayLabel, toDateInput, todayNoonUTC } from "@/lib/dates"
import { getSelectOptions } from "@/lib/queries"
import { teamSnapshot } from "./data"

const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP_TIME_ZONE })

/** Same buckets as the intro's welcome note, so the greeting carries straight on from it. */
function greeting(now: Date) {
  const h = Number(hourFmt.format(now))
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening"
}

/** Date, greeting and (admins) quick actions. */
export function Hero({ admin }: { admin: boolean }) {
  const now = new Date()
  return (
    <section
      data-panel
      style={{ "--i": 0 } as React.CSSProperties}
      aria-labelledby="dash-greeting"
      className="grid gap-x-8 gap-y-3 xl:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0">
        <p className="eyebrow mb-4 flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-[3px] rounded-[1px] bg-brand" />
          <time dateTime={toDateInput(todayNoonUTC())}>{dayLabel(now, APP_TIME_ZONE, { weekday: true, year: true })}</time>
        </p>
        <h1 id="dash-greeting" className="font-display text-[1.75rem] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance sm:text-[2.25rem]">
          {greeting(now)}.
        </h1>
      </div>
      {admin && (
        <div className="order-3 flex flex-wrap gap-2 xl:order-none xl:self-end xl:justify-end">
          <Suspense fallback={<QuickActionButtons />}>
            <QuickActions />
          </Suspense>
        </div>
      )}
    </section>
  )
}

async function QuickActions() {
  const [options, teams] = await Promise.all([getSelectOptions(), teamSnapshot()])
  return <QuickActionButtons options={options} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
}

/** Without data (Suspense fallback) the same buttons render disabled, so nothing jumps. */
function QuickActionButtons({ options, teams }: { options?: Awaited<ReturnType<typeof getSelectOptions>>; teams?: { id: string; name: string }[] }) {
  const issue = (
    <Button variant="brand" disabled={!options}>
      <ArrowUpRight /> Issue component
    </Button>
  )
  const add = (
    <Button variant="outline">
      <PackagePlus /> Add component
    </Button>
  )
  const project = (
    <Button variant="outline" disabled={!teams}>
      <FolderPlus /> New project
    </Button>
  )
  return (
    <>
      {options ? <IssueDialog options={options} trigger={issue} /> : issue}
      <ComponentFormDialog trigger={add} />
      {teams ? <ProjectFormDialog teams={teams} trigger={project} /> : project}
    </>
  )
}
