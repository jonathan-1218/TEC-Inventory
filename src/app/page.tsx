import { Suspense } from "react"
import type { Metadata } from "next"
import { parseRange, type Range } from "@/components/charts"
import { AttentionBody } from "@/components/dashboard/attention"
import { CheckoutPanel } from "@/components/dashboard/checkout-panel"
import { checkoutSeries } from "@/components/dashboard/data"
import { Hero } from "@/components/dashboard/hero"
import { KPI_GRID, KpiCards, KpiSkeletons } from "@/components/dashboard/kpi-cards"
import { Panel, PanelLink, PanelSkeleton } from "@/components/dashboard/panel"
import { InventoryHealthBody, ProjectsBody } from "@/components/dashboard/panels"
import { Stage } from "@/components/dashboard/stage"
import { isAdmin } from "@/lib/auth"

export const metadata: Metadata = { title: "Dashboard" }

// Every panel is its own async server component inside <Suspense>: they all start fetching at once and stream in as
// they finish, instead of the page waiting for the slowest query (~130 ms per round trip on the hosted database).
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const [{ range }, admin] = await Promise.all([searchParams, isAdmin()])

  return (
    <Stage className="flex flex-col gap-8 lg:gap-10">
      <Hero admin={admin} />

      <div className={KPI_GRID}>
        <Suspense fallback={<KpiSkeletons from={1} />}>
          <KpiCards from={1} />
        </Suspense>
      </div>

      {/* Two rows of two equal panels: what's happening and what needs doing, then the work and the stock. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
        <Suspense fallback={<ChartFallback />}>
          <Checkouts range={parseRange(range).range} />
        </Suspense>

        <Panel i={6} id="attention" eyebrow="Needs attention" title="Due, late and running low">
          <Suspense fallback={<PanelSkeleton rows={5} />}>
            <AttentionBody admin={admin} />
          </Suspense>
        </Panel>

        <Panel i={8} eyebrow="Work" title="Projects in motion" action={<PanelLink href="/projects">All projects</PanelLink>}>
          <Suspense fallback={<PanelSkeleton rows={3} />}>
            <ProjectsBody limit={3} />
          </Suspense>
        </Panel>

        <Panel i={9} eyebrow="Stock" title="Inventory health" action={<PanelLink href="/inventory">Inventory</PanelLink>}>
          <Suspense fallback={<PanelSkeleton height={240} />}>
            <InventoryHealthBody maxRows={5} />
          </Suspense>
        </Panel>
      </div>
    </Stage>
  )
}

async function Checkouts({ range }: { range: Range }) {
  return <CheckoutPanel data={await checkoutSeries()} initialRange={range} i={7} />
}

function ChartFallback() {
  return (
    <Panel i={7} eyebrow="Checkouts" title="Parts out vs parts back">
      <PanelSkeleton height={300} />
    </Panel>
  )
}
