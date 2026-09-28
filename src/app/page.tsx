import { Suspense } from "react"
import type { Metadata } from "next"
import { parseRange, type Range } from "@/components/charts"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { AttentionBody } from "@/components/dashboard/attention"
import { CheckoutPanel } from "@/components/dashboard/checkout-panel"
import { checkoutSeries } from "@/components/dashboard/data"
import { Hero } from "@/components/dashboard/hero"
import { KPI_GRID, KpiCards, KpiSkeletons } from "@/components/dashboard/kpi-cards"
import { Panel, PanelLink, PanelSkeleton } from "@/components/dashboard/panel"
import { HeatmapBody, InventoryHealthBody, ProjectsBody, TeamsBody } from "@/components/dashboard/panels"
import { Stage } from "@/components/dashboard/stage"
import { isAdmin } from "@/lib/auth"

export const metadata: Metadata = { title: "Dashboard" }

// Every panel is its own async server component inside <Suspense>: they all start fetching at once and stream in as
// they finish, instead of the page waiting for the slowest query (~130 ms per round trip on the hosted database).
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const [{ range }, admin] = await Promise.all([searchParams, isAdmin()])

  return (
    <Stage className="flex flex-col gap-6">
      <Hero admin={admin} />

      <div className={KPI_GRID}>
        <Suspense fallback={<KpiSkeletons from={1} />}>
          <KpiCards from={1} />
        </Suspense>
      </div>

      {/* xl: main column (charts) + rail (things to act on). Below xl the columns dissolve (display: contents) and
          `order` puts the actionable panels right after the KPIs. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-12 xl:items-start">
        <div className="contents xl:col-span-8 xl:flex xl:flex-col xl:gap-4">
          <Suspense fallback={<ChartFallback />}>
            <Checkouts range={parseRange(range).range} />
          </Suspense>

          <Panel i={8} eyebrow="Work" title="Projects in motion" action={<PanelLink href="/projects">All projects</PanelLink>} className="order-3 xl:order-none">
            <Suspense fallback={<PanelSkeleton rows={3} />}>
              <ProjectsBody />
            </Suspense>
          </Panel>

          <div className="order-4 grid gap-4 md:grid-cols-2 xl:order-none">
            <Panel i={9} eyebrow="Stock" title="Inventory health" action={<PanelLink href="/inventory">Inventory</PanelLink>}>
              <Suspense fallback={<PanelSkeleton height={280} />}>
                <InventoryHealthBody />
              </Suspense>
            </Panel>
            <Panel i={10} eyebrow="People" title="Team snapshot" action={<PanelLink href="/teams">Teams</PanelLink>}>
              <Suspense fallback={<PanelSkeleton rows={3} />}>
                <TeamsBody />
              </Suspense>
            </Panel>
          </div>

          <Panel
            i={11}
            eyebrow="Activity · 26 weeks"
            title="Club activity"
            description="Checkouts, returns, progress updates and finished tasks per day."
            className="order-5 xl:order-none"
          >
            <Suspense fallback={<PanelSkeleton height={170} />}>
              <HeatmapBody />
            </Suspense>
          </Panel>
        </div>

        <div className="contents xl:col-span-4 xl:flex xl:flex-col xl:gap-4">
          <Panel
            i={6}
            id="attention"
            eyebrow="Needs attention"
            title="Due, late and running low"
            className="order-1 xl:order-none"
          >
            <Suspense fallback={<PanelSkeleton rows={6} />}>
              <AttentionBody admin={admin} />
            </Suspense>
          </Panel>

          <Panel i={12} eyebrow="Log" title="Recent activity" className="order-6 xl:order-none">
            <Suspense fallback={<PanelSkeleton rows={8} />}>
              <ActivityFeed />
            </Suspense>
          </Panel>
        </div>
      </div>
    </Stage>
  )
}

async function Checkouts({ range }: { range: Range }) {
  return <CheckoutPanel data={await checkoutSeries()} initialRange={range} i={7} className="order-2 xl:order-none" />
}

function ChartFallback() {
  return (
    <Panel i={7} eyebrow="Checkouts" title="Parts out vs parts back" className="order-2 xl:order-none">
      <PanelSkeleton height={300} />
    </Panel>
  )
}
